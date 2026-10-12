### Task 1: Typed entitlement and limit denials

`GatedFeature` comes from phase 1a's `src/lib/entitlements-shared.ts`. It is imported type-only, so `errors.ts` stays free of zod at runtime.

**Files:**

- Modify: `src/lib/errors.ts`
- Test: `src/lib/__tests__/errors.test.ts` (extended; shown below as the whole file)
- Not touched: `src/app/api/__tests__/error-bodies.test.ts`. It pins the fixed 500 bodies of unexpected errors and never goes through `apiErrorResponse`, so there is nothing to extend there.

**Interfaces:**

- Produces in `src/lib/errors.ts`:
  - `ForbiddenCode` gains `"limit_reached" | "organization_required" | "session_required" | "bad_origin"`.
  - `ForbiddenError` gains `responseFields(): Record<string, string | number | null>` returning `{}`.
  - `class EntitlementError extends ForbiddenError { readonly feature: GatedFeature; constructor(feature: GatedFeature) }`; code `feature_not_entitled`; message `"Forbidden: This feature is not available for your organization"`; `responseFields()` returns `{ feature }`.
  - `type LimitResource = "assets" | "users"`; `class LimitError extends ForbiddenError { readonly resource: LimitResource; readonly max: number | null; constructor(resource: LimitResource, max: number | null) }`; code `limit_reached`; message `"Forbidden: Your organization has reached its asset limit"` or `"... user limit"`; `responseFields()` returns `{ resource, max }`.
  - `apiErrorResponse` answers a `ForbiddenError` with `{ error, code, ...error.responseFields() }`. The extra fields are spread first in the code, so a subclass can never overwrite `error` or `code`; the JSON has the same keys.

- [ ] **Step 1: Write the failing tests**

Replace the whole file `src/lib/__tests__/errors.test.ts` with:

```ts
import { describe, it, expect } from "vitest";
import {
  AppError,
  EntitlementError,
  ForbiddenError,
  LimitError,
  UnauthorizedError,
  apiErrorResponse,
} from "@/lib/errors";

describe("typed auth errors", () => {
  it("ForbiddenError keeps the 'Forbidden: ' prefix and carries a code", () => {
    const err = new ForbiddenError("org_locked", "Organization suspended");
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Forbidden: Organization suspended");
    expect(err.code).toBe("org_locked");
    expect(err.statusCode).toBe(403);
  });

  it("UnauthorizedError defaults to 'Unauthorized'", () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe("Unauthorized");
    expect(err.statusCode).toBe(401);
  });

  it("ForbiddenError has no extra response fields", () => {
    const err = new ForbiddenError("org_locked", "Organization suspended");
    expect(err.responseFields()).toEqual({});
  });
});

describe("EntitlementError", () => {
  it("is a ForbiddenError with the feature and a neutral message", () => {
    const err = new EntitlementError("procurement");
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err).toBeInstanceOf(AppError);
    expect(err.name).toBe("EntitlementError");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("feature_not_entitled");
    expect(err.feature).toBe("procurement");
    expect(err.message).toBe(
      "Forbidden: This feature is not available for your organization",
    );
    expect(err.message.startsWith("Forbidden")).toBe(true);
  });

  it("exposes the feature as a response field", () => {
    expect(new EntitlementError("scim").responseFields()).toEqual({
      feature: "scim",
    });
  });

  it("never names a plan, a price or an upgrade", () => {
    expect(new EntitlementError("api_keys").message).not.toMatch(
      /plan|price|upgrade|professional|enterprise|starter/i,
    );
  });
});

describe("LimitError", () => {
  it("is a ForbiddenError for the asset limit", () => {
    const err = new LimitError("assets", 100);
    expect(err).toBeInstanceOf(ForbiddenError);
    expect(err.name).toBe("LimitError");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("limit_reached");
    expect(err.resource).toBe("assets");
    expect(err.max).toBe(100);
    expect(err.message).toBe(
      "Forbidden: Your organization has reached its asset limit",
    );
  });

  it("words the user limit separately", () => {
    expect(new LimitError("users", 3).message).toBe(
      "Forbidden: Your organization has reached its user limit",
    );
  });

  it("exposes resource and max as response fields", () => {
    expect(new LimitError("users", 3).responseFields()).toEqual({
      resource: "users",
      max: 3,
    });
    expect(new LimitError("assets", null).responseFields()).toEqual({
      resource: "assets",
      max: null,
    });
  });

  it("never names a plan, a price or an upgrade", () => {
    expect(new LimitError("assets", 0).message).not.toMatch(
      /plan|price|upgrade|professional|enterprise|starter/i,
    );
  });
});

describe("apiErrorResponse", () => {
  it("maps ForbiddenError to 403 with error and code", async () => {
    const res = apiErrorResponse(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: "Forbidden: Organization is in read-only mode",
      code: "org_read_only",
    });
  });

  it("maps the new forbidden codes without extra fields", async () => {
    for (const code of [
      "organization_required",
      "session_required",
      "bad_origin",
    ] as const) {
      const res = apiErrorResponse(new ForbiddenError(code, "Denied"));
      expect(res?.status).toBe(403);
      await expect(res?.json()).resolves.toEqual({
        error: "Forbidden: Denied",
        code,
      });
    }
  });

  it("maps EntitlementError to 403 with the feature", async () => {
    const res = apiErrorResponse(new EntitlementError("tco_dashboard"));
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: "Forbidden: This feature is not available for your organization",
      code: "feature_not_entitled",
      feature: "tco_dashboard",
    });
  });

  it("maps LimitError to 403 with resource and max", async () => {
    const res = apiErrorResponse(new LimitError("assets", 100));
    expect(res?.status).toBe(403);
    await expect(res?.json()).resolves.toEqual({
      error: "Forbidden: Your organization has reached its asset limit",
      code: "limit_reached",
      resource: "assets",
      max: 100,
    });
  });

  it("keeps max in the body when the limit is null", async () => {
    const res = apiErrorResponse(new LimitError("users", null));
    await expect(res?.json()).resolves.toMatchObject({
      resource: "users",
      max: null,
    });
  });

  it("maps UnauthorizedError to 401", async () => {
    const res = apiErrorResponse(new UnauthorizedError());
    expect(res?.status).toBe(401);
    await expect(res?.json()).resolves.toEqual({
      error: "Unauthorized",
      code: "unauthorized",
    });
  });

  it("returns null for any other error so routes keep their own handling", () => {
    expect(apiErrorResponse(new Error("boom"))).toBeNull();
    expect(apiErrorResponse("string")).toBeNull();
    expect(apiErrorResponse(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: FAIL, 11 failed | 6 passed (`EntitlementError is not a constructor`, `LimitError is not a constructor`, `err.responseFields is not a function`).

- [ ] **Step 3: Implement the errors**

In `src/lib/errors.ts`:

Replace:

```ts
import { NextResponse } from "next/server";

export type ForbiddenCode =
```

with:

```ts
import { NextResponse } from "next/server";
import type { GatedFeature } from "@/lib/entitlements-shared";

export type ForbiddenCode =
```

Replace:

```ts
  | "request_permission"
  | "feature_not_entitled";
```

with:

```ts
  | "request_permission"
  | "feature_not_entitled"
  | "limit_reached"
  | "organization_required"
  | "session_required"
  | "bad_origin";
```

Replace:

```ts
    super(`Forbidden: ${message}`, 403);
    this.code = code;
  }
}
```

with:

```ts
    super(`Forbidden: ${message}`, 403);
    this.code = code;
  }

  /** Machine-readable fields added to the 403 body next to `error` and `code`. */
  responseFields(): Record<string, string | number | null> {
    return {};
  }
}

/**
 * 403: the organization's entitlements do not include this feature. The
 * message is neutral on purpose: it never names a plan or a price.
 */
export class EntitlementError extends ForbiddenError {
  readonly feature: GatedFeature;

  constructor(feature: GatedFeature) {
    super(
      "feature_not_entitled",
      "This feature is not available for your organization",
    );
    this.feature = feature;
  }

  override responseFields(): Record<string, string | number | null> {
    return { feature: this.feature };
  }
}

export type LimitResource = "assets" | "users";

/** 403: creating one more record would exceed the organization's limit. */
export class LimitError extends ForbiddenError {
  readonly resource: LimitResource;
  /** The limit that was hit; null means unlimited (never hit in practice). */
  readonly max: number | null;

  constructor(resource: LimitResource, max: number | null) {
    super(
      "limit_reached",
      `Your organization has reached its ${resource === "assets" ? "asset" : "user"} limit`,
    );
    this.resource = resource;
    this.max = max;
  }

  override responseFields(): Record<string, string | number | null> {
    return { resource: this.resource, max: this.max };
  }
}
```

Replace:

```ts
export function apiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof UnauthorizedError || error instanceof ForbiddenError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  return null;
}
```

with:

```ts
export function apiErrorResponse(error: unknown): NextResponse | null {
  if (error instanceof ForbiddenError) {
    // Extra fields go first so they can never shadow `error` or `code`.
    return NextResponse.json(
      { ...error.responseFields(), error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode },
    );
  }
  return null;
}
```

- [ ] **Step 4: Run the tests and the checks**

Run: `npx vitest run src/lib/__tests__/errors.test.ts`
Expected: PASS (17 tests).

Run: `npx tsc --noEmit -p .` and `npx eslint src/lib/errors.ts src/lib/__tests__/errors.test.ts`
Expected: no output.

Run: `npx vitest run` (`errors.ts` is imported by nearly every route)
Expected: all pass; the DB-backed suites are skipped locally.

- [ ] **Step 5: Commit**

```bash
git add src/lib/errors.ts src/lib/__tests__/errors.test.ts
git commit -m "feat: add typed entitlement and limit denials"
```
