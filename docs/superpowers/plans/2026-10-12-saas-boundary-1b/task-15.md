### Task 15: Billing handoff and CSP

An admin reaches the control plane's billing portal through a short-lived signed token. The core answers `POST /api/billing/handoff` with a page whose form posts the token to `BILLING_URL/handoff`, so the token travels in a request body only: never in a URL, a `Location` header or a `Referer`. Locked and read-only admins must still get through to pay, so the route uses `getAuthUser()` and skips the organization status block, like the legacy portal route. Outside cloud mode (no `CONTROL_PLANE_SECRET`) the route does not exist, whatever `BILLING_URL` holds (Review Focus 1). This task also moves the CSP builder out of `src/proxy.ts` so the billing origin can join `form-action` and the header can be tested, and gives `/suspended` its "Manage billing" entry.

**Files:**

- Create: `src/lib/html-escape.ts`
- Create: `src/lib/app-origin.ts`
- Create: `src/lib/csp.ts`
- Create: `src/lib/control-plane/handoff.ts`
- Create: `src/app/api/billing/handoff/route.ts`
- Modify: `src/proxy.ts` (import `buildCspHeader` from `csp.ts`)
- Modify: `src/lib/email/templates.ts` (import the shared `escapeHtml`)
- Modify: `src/app/suspended/page.tsx`
- Modify: `src/app/api/__tests__/route-conventions.test.ts` (`WRITE_GUARD_EXEMPT`)
- Test: `src/lib/__tests__/html-escape.test.ts` (create)
- Test: `src/lib/__tests__/app-origin.test.ts` (create)
- Test: `src/lib/__tests__/csp.test.ts` (create)
- Test: `src/lib/__tests__/handoff.test.ts` (create)
- Test: `src/app/api/__tests__/billing-handoff.test.ts` (create)
- Test: `src/app/__tests__/suspended-page.test.ts` (create)

**Interfaces:**

- Consumes: `isCloudMode`, `isBillingEnabled` (Task 2); `tests/setup/cloud-mode.ts` (Task 2); `validateServiceUrl` (Task 4); `orgAccessSelect`/`resolveOrgAccess` through the real `getAuthUser` (Task 6); `deriveKey` (Task 12); the `session_required`, `bad_origin` and `organization_required` codes of `ForbiddenError` (Task 1); `isLegacyBillingActive` (phase 1a).
- Produces `escapeHtml(value: string): string` in `src/lib/html-escape.ts`; `getAppOrigin(): string` in `src/lib/app-origin.ts` (`new URL(getBaseUrl()).origin`).
- Produces in `src/lib/csp.ts`: `getBillingOrigin(env?: EnvRecord): string | null` (a valid `BILLING_URL` as an origin, else `null`; it applies `validateServiceUrl(..., { originOnly: true })`, so it agrees with startup validation, and never throws) and `buildCspHeader(nonce: string, env?: EnvRecord): string` (the directives of today; `form-action` keeps `'self' https://billing.stripe.com` and appends the billing origin when set).
- Produces in `src/lib/control-plane/handoff.ts`: `HandoffClaims { userId; orgId; email }`, `signHandoffToken(claims, now?): Promise<string>` (HS256, key `deriveKey("handoff-v1")`, `iss` = app origin, `aud` = `"billing-handoff"`, `sub`, `orgId`, `email`, `jti` = `randomUUID()`, `iat`, `exp = iat + 60`), `renderHandoffPage({ action, token, nonce }): string`; also the constants `HANDOFF_AUDIENCE` and `HANDOFF_TTL_SECONDS`.
- Route `POST /api/billing/handoff`: not cloud mode or no valid `BILLING_URL` -> 404 `{ error: "Not found", code: "not_found" }` before any auth work; `getAuthUser()` (no status block); API key -> 403 `session_required`; not admin -> 403 `not_admin`; `Origin` missing or not the app origin -> 403 `bad_origin`; no organization -> 403 `organization_required`; no email -> 403 `not_admin`; otherwise 200 `text/html; charset=utf-8` with `Cache-Control: no-store` and `Referrer-Policy: strict-origin` (not `no-referrer`: under it a cross-origin POST carries `Origin: null`, and the control plane must check `Origin`). The nonce is the request header `x-nonce` set by the proxy.
- `/suspended`: an admin in cloud mode gets the "Manage billing" form to `/api/billing/handoff` when `BILLING_URL` is valid; else the existing Stripe portal form while legacy billing is active; else the contact text.

Both parts end in their own commit. Part A is a refactor-plus-addition with no new route; Part B depends on it.

#### Part A: shared helpers and the CSP builder

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/html-escape.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { escapeHtml } from "@/lib/html-escape";

describe("escapeHtml", () => {
  it("escapes the five characters that matter in HTML text and attributes", () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("escapes an ampersand once, before the other entities", () => {
    expect(escapeHtml("&lt;")).toBe("&amp;lt;");
  });

  it("leaves plain text alone", () => {
    expect(escapeHtml("Asset Tracker 1.0")).toBe("Asset Tracker 1.0");
  });
});
```

Create `src/lib/__tests__/app-origin.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { getAppOrigin } from "@/lib/app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppOrigin", () => {
  it("drops a trailing slash", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com/");
    expect(getAppOrigin()).toBe("https://app.example.com");
  });

  it("drops a path and keeps a non-default port", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com:8443/base/path");
    expect(getAppOrigin()).toBe("https://app.example.com:8443");
  });

  it("falls back to NEXT_PUBLIC_APP_URL like getBaseUrl", () => {
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fallback.example.com/x");
    expect(getAppOrigin()).toBe("https://fallback.example.com");
  });
});
```

Create `src/lib/__tests__/csp.test.ts`. The last block drives the real `proxy()` like `proxy-service-worker.test.ts` does, with the lock redirect mocked: `/login` is a public page route, so no rate limiter and no session are involved.

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/org-lock-redirect", () => ({
  shouldCheckOrgLock: vi.fn(() => false),
  getLockedRedirect: vi.fn(async () => null),
}));

import { buildCspHeader, getBillingOrigin } from "@/lib/csp";
import { proxy } from "@/proxy";

const NONCE = "bm9uY2U=";
const STRIPE = "https://billing.stripe.com";

/** The value of one directive, for example directive(header, "form-action"). */
function directive(header: string, name: string): string | undefined {
  return header
    .split("; ")
    .find((part) => part === name || part.startsWith(`${name} `));
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBillingOrigin", () => {
  it("is null when BILLING_URL is unset or empty", () => {
    expect(getBillingOrigin({})).toBeNull();
    expect(getBillingOrigin({ BILLING_URL: "" })).toBeNull();
  });

  it("returns the origin of a valid https URL", () => {
    expect(
      getBillingOrigin({ BILLING_URL: "https://billing.example.com" }),
    ).toBe("https://billing.example.com");
    expect(
      getBillingOrigin({ BILLING_URL: "https://billing.example.com/" }),
    ).toBe("https://billing.example.com");
  });

  it.each([
    ["not a URL", "billing"],
    ["plain http in production", "http://billing.example.com"],
    ["credentials", "https://user:secret@billing.example.com"],
    ["a query", "https://billing.example.com/?a=1"],
    ["a fragment", "https://billing.example.com/#x"],
    ["a path", "https://billing.example.com/app"],
    ["a script URL", "javascript:alert(1)"],
  ])("is null for %s and never throws", (_label, value) => {
    expect(
      getBillingOrigin({ NODE_ENV: "production", BILLING_URL: value }),
    ).toBeNull();
  });

  it("allows http on localhost outside production only", () => {
    expect(
      getBillingOrigin({
        NODE_ENV: "development",
        BILLING_URL: "http://localhost:4000",
      }),
    ).toBe("http://localhost:4000");
    expect(
      getBillingOrigin({
        NODE_ENV: "production",
        BILLING_URL: "http://localhost:4000",
      }),
    ).toBeNull();
  });
});

describe("buildCspHeader", () => {
  it("keeps today's directives", () => {
    const header = buildCspHeader(NONCE, { NODE_ENV: "production" });

    expect(directive(header, "default-src")).toBe("default-src 'self'");
    expect(directive(header, "script-src")).toBe(
      `script-src 'nonce-${NONCE}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`,
    );
    expect(directive(header, "style-src")).toBe(
      "style-src 'self' 'unsafe-inline'",
    );
    expect(directive(header, "img-src")).toBe(
      "img-src 'self' data: blob: https:",
    );
    expect(directive(header, "font-src")).toBe("font-src 'self' data:");
    expect(directive(header, "worker-src")).toBe("worker-src 'self' blob:");
    expect(directive(header, "frame-src")).toBe(
      "frame-src 'self' https://*.stripe.com https://challenges.cloudflare.com",
    );
    expect(directive(header, "object-src")).toBe("object-src 'none'");
    expect(directive(header, "base-uri")).toBe("base-uri 'self'");
    expect(directive(header, "frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directive(header, "connect-src")).toContain("https://*.stripe.com");
  });

  it("keeps the Stripe origin in form-action when BILLING_URL is unset", () => {
    const header = buildCspHeader(NONCE, { NODE_ENV: "production" });
    expect(directive(header, "form-action")).toBe(
      `form-action 'self' ${STRIPE}`,
    );
  });

  it("appends the billing origin to form-action when BILLING_URL is set", () => {
    const header = buildCspHeader(NONCE, {
      NODE_ENV: "production",
      BILLING_URL: "https://billing.example.com/",
    });
    expect(directive(header, "form-action")).toBe(
      `form-action 'self' ${STRIPE} https://billing.example.com`,
    );
  });

  it("ignores an invalid BILLING_URL", () => {
    const header = buildCspHeader(NONCE, {
      NODE_ENV: "production",
      BILLING_URL: "https://user:secret@billing.example.com",
    });
    expect(directive(header, "form-action")).toBe(
      `form-action 'self' ${STRIPE}`,
    );
    expect(header).not.toContain("secret");
  });

  it("allows the dev inspector origin only outside production", () => {
    expect(
      directive(
        buildCspHeader(NONCE, { NODE_ENV: "development" }),
        "connect-src",
      ),
    ).toContain("https://127.0.0.1:41951");
    expect(
      directive(
        buildCspHeader(NONCE, { NODE_ENV: "production" }),
        "connect-src",
      ),
    ).not.toContain("127.0.0.1");
  });
});

describe("proxy CSP header", () => {
  async function cspFor(path: string): Promise<string> {
    const res = await proxy(new NextRequest(`http://localhost${path}`));
    return res.headers.get("content-security-policy") ?? "";
  }

  it("lets forms post to the billing origin when BILLING_URL is set", async () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com");

    const header = await cspFor("/login");

    expect(directive(header, "form-action")).toBe(
      `form-action 'self' ${STRIPE} https://billing.example.com`,
    );
  });

  it("leaves form-action alone when BILLING_URL is unset", async () => {
    vi.stubEnv("BILLING_URL", "");

    const header = await cspFor("/login");

    expect(directive(header, "form-action")).toBe(
      `form-action 'self' ${STRIPE}`,
    );
  });

  it("reads BILLING_URL on every request instead of caching it at import", async () => {
    vi.stubEnv("BILLING_URL", "");
    expect(directive(await cspFor("/login"), "form-action")).toBe(
      `form-action 'self' ${STRIPE}`,
    );

    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    expect(directive(await cspFor("/login"), "form-action")).toContain(
      "https://billing.example.com",
    );
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/html-escape.test.ts src/lib/__tests__/app-origin.test.ts src/lib/__tests__/csp.test.ts`
Expected: FAIL. All three files fail to load because `@/lib/html-escape`, `@/lib/app-origin` and `@/lib/csp` do not exist yet.

- [ ] **Step 3: Write the helpers and move the CSP builder**

Create `src/lib/html-escape.ts`:

```ts
/**
 * Escape a value for safe interpolation into an HTML text node or a quoted
 * attribute. Shared by the email templates and the billing handoff page.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Make `src/lib/email/templates.ts` use it instead of its private copy. `renderTemplate` keeps escaping every substituted value exactly as before (`email-templates.test.ts` pins that).

In `src/lib/email/templates.ts`, import the shared helper below the header comment.

Replace:

```ts
/**
 * Email Templates
 * Pre-defined templates for various notification types
 */

export interface TemplateVariables {
```

With:

```ts
/**
 * Email Templates
 * Pre-defined templates for various notification types
 */

import { escapeHtml } from "@/lib/html-escape";

export interface TemplateVariables {
```

In `src/lib/email/templates.ts`, remove the private copy.

Delete:

```ts
/**
 * Escape a value for safe interpolation into an HTML document body/attribute.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
```

Create `src/lib/app-origin.ts`:

```ts
import { getBaseUrl } from "@/lib/url";

/**
 * The application's origin: scheme, host and port, with no path and no
 * trailing slash. BETTER_AUTH_URL may carry either, so every origin
 * comparison (the handoff Origin check) and every token issuer must use this
 * instead of the raw value.
 */
export function getAppOrigin(): string {
  return new URL(getBaseUrl()).origin;
}
```

Create `src/lib/csp.ts`. The directives are the ones `src/proxy.ts` builds today; the differences are the `env` parameter (read on every request, never cached at import) and the billing origin in `form-action`.

```ts
import { validateServiceUrl } from "@/lib/control-plane/config";
import type { EnvRecord } from "@/lib/host-routing";

/** The origin Stripe's billing portal answers form posts from (legacy billing). */
const STRIPE_BILLING_ORIGIN = "https://billing.stripe.com";

/**
 * The origin of BILLING_URL, or null when it is unset or invalid. It applies
 * the same rules as startup validation (https, no credentials, no query, no
 * path), so a value the server refused to start with never reaches a header.
 * Never throws: the proxy calls this on every request.
 */
export function getBillingOrigin(env: EnvRecord = process.env): string | null {
  const value = env.BILLING_URL;
  if (!value) return null;
  const problem = validateServiceUrl("BILLING_URL", value, env, {
    originOnly: true,
  });
  return problem === null ? new URL(value).origin : null;
}

/** The Content-Security-Policy header value for one request. */
export function buildCspHeader(
  nonce: string,
  env: EnvRecord = process.env,
): string {
  const billingOrigin = getBillingOrigin(env);
  const formAction = [
    "'self'",
    // Stripe: the /suspended "Manage subscription" form POST is answered with a
    // 303 to the billing portal, and Chrome applies form-action to that redirect.
    STRIPE_BILLING_ORIGIN,
    // The control plane receives the handoff form (POST /api/billing/handoff).
    ...(billingOrigin ? [billingOrigin] : []),
  ].join(" ");

  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.sentry.io https://*.stripe.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://nominatim.openstreetmap.org https://analytics.711x.de https://challenges.cloudflare.com${env.NODE_ENV !== "production" ? " https://127.0.0.1:41951" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.stripe.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    `form-action ${formAction}`,
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
```

In `src/proxy.ts`, use the shared builder. `splitOrigins` stays where it is; the call `buildCspHeader(nonce)` inside `proxy()` is unchanged.

In `src/proxy.ts`, import the shared builder below the service-worker import.

Replace:

```ts
import { isServiceWorkerPath } from "@/lib/service-worker-paths";
```

With:

```ts
import { isServiceWorkerPath } from "@/lib/service-worker-paths";
import { buildCspHeader } from "@/lib/csp";
```

In `src/proxy.ts`, remove the private builder (the whole function and the blank line after it).

Delete:

```ts
function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.sentry.io https://*.stripe.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://nominatim.openstreetmap.org https://analytics.711x.de https://challenges.cloudflare.com${process.env.NODE_ENV !== "production" ? " https://127.0.0.1:41951" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.stripe.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    // Stripe: the /suspended "Manage subscription" form POST is answered with a
    // 303 to the billing portal, and Chrome applies form-action to that redirect.
    "form-action 'self' https://billing.stripe.com",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}
```

- [ ] **Step 4: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/html-escape.test.ts src/lib/__tests__/app-origin.test.ts src/lib/__tests__/csp.test.ts src/lib/__tests__/email-templates.test.ts src/lib/__tests__/proxy-service-worker.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .` and `npx eslint src/lib/html-escape.ts src/lib/app-origin.ts src/lib/csp.ts src/lib/email/templates.ts src/proxy.ts src/lib/__tests__/html-escape.test.ts src/lib/__tests__/app-origin.test.ts src/lib/__tests__/csp.test.ts`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/html-escape.ts src/lib/app-origin.ts src/lib/csp.ts src/lib/email/templates.ts src/proxy.ts src/lib/__tests__/html-escape.test.ts src/lib/__tests__/app-origin.test.ts src/lib/__tests__/csp.test.ts
git commit -m "feat: allow the billing origin in the CSP and share the HTML escaper"
```

#### Part B: handoff token, route and the suspended page

- [ ] **Step 6: Write the failing tests**

Create `src/lib/__tests__/handoff.test.ts`. It verifies tokens with `jwtVerify` and the derived key, the way the control plane will, and renders the page with hostile values.

```ts
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { jwtVerify, decodeProtectedHeader, errors } from "jose";
import {
  HANDOFF_AUDIENCE,
  HANDOFF_TTL_SECONDS,
  renderHandoffPage,
  signHandoffToken,
} from "@/lib/control-plane/handoff";
import { deriveKey } from "@/lib/control-plane/keys";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../tests/setup/cloud-mode";

const CLAIMS = {
  userId: "11111111-1111-4111-8111-111111111111",
  orgId: "22222222-2222-4222-8222-222222222222",
  email: "admin@example.com",
};
const APP_ORIGIN = "https://app.example.com";
const NOW = new Date("2026-10-12T10:00:00.000Z");

beforeEach(() => {
  stubCloudMode();
  vi.stubEnv("BETTER_AUTH_URL", `${APP_ORIGIN}/`);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function handoffKey(): Uint8Array {
  return deriveKey("handoff-v1", TEST_CONTROL_PLANE_SECRET);
}

describe("signHandoffToken", () => {
  it("signs an HS256 token with the claims the control plane verifies", async () => {
    const token = await signHandoffToken(CLAIMS, NOW);

    expect(decodeProtectedHeader(token)).toMatchObject({ alg: "HS256" });
    const { payload } = await jwtVerify(token, handoffKey(), {
      issuer: APP_ORIGIN,
      audience: HANDOFF_AUDIENCE,
      currentDate: NOW,
    });
    expect(payload).toMatchObject({
      iss: APP_ORIGIN,
      aud: "billing-handoff",
      sub: CLAIMS.userId,
      orgId: CLAIMS.orgId,
      email: CLAIMS.email,
      iat: NOW.getTime() / 1000,
    });
    expect(payload.jti).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("expires 60 seconds after it was issued", async () => {
    const token = await signHandoffToken(CLAIMS, NOW);

    const { payload } = await jwtVerify(token, handoffKey(), {
      currentDate: NOW,
    });
    expect(HANDOFF_TTL_SECONDS).toBe(60);
    expect(payload.exp).toBe(NOW.getTime() / 1000 + 60);

    await expect(
      jwtVerify(token, handoffKey(), {
        currentDate: new Date(NOW.getTime() + 59_000),
      }),
    ).resolves.toBeDefined();
    await expect(
      jwtVerify(token, handoffKey(), {
        currentDate: new Date(NOW.getTime() + 61_000),
      }),
    ).rejects.toBeInstanceOf(errors.JWTExpired);
  });

  it("uses a fresh jti for every token", async () => {
    const first = await jwtVerify(
      await signHandoffToken(CLAIMS, NOW),
      handoffKey(),
      { currentDate: NOW },
    );
    const second = await jwtVerify(
      await signHandoffToken(CLAIMS, NOW),
      handoffKey(),
      { currentDate: NOW },
    );

    expect(first.payload.jti).not.toBe(second.payload.jti);
  });

  it("uses the app origin without a trailing slash as the issuer", async () => {
    const token = await signHandoffToken(CLAIMS, NOW);
    const { payload } = await jwtVerify(token, handoffKey(), {
      currentDate: NOW,
    });

    expect(payload.iss).toBe("https://app.example.com");
  });

  it("is not verifiable with the events key or another secret", async () => {
    const token = await signHandoffToken(CLAIMS, NOW);

    await expect(
      jwtVerify(token, deriveKey("events-v1", TEST_CONTROL_PLANE_SECRET), {
        currentDate: NOW,
      }),
    ).rejects.toBeInstanceOf(errors.JWSSignatureVerificationFailed);
    await expect(
      jwtVerify(token, deriveKey("handoff-v1", "x".repeat(48)), {
        currentDate: NOW,
      }),
    ).rejects.toBeInstanceOf(errors.JWSSignatureVerificationFailed);
  });

  it("does not carry the control plane secret", async () => {
    const token = await signHandoffToken(CLAIMS, NOW);

    expect(token).not.toContain(TEST_CONTROL_PLANE_SECRET);
    expect(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    ).not.toContain(TEST_CONTROL_PLANE_SECRET);
  });

  it("throws when there is no control plane secret", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");

    await expect(signHandoffToken(CLAIMS, NOW)).rejects.toThrow();
  });
});

describe("renderHandoffPage", () => {
  const ACTION = "https://billing.example.com/handoff";

  it("posts the token in a form body and submits it with a nonce'd script", () => {
    const html = renderHandoffPage({
      action: ACTION,
      token: "header.payload.signature",
      nonce: "bm9uY2U=",
    });

    expect(html).toContain(
      `<form id="handoff" method="post" action="${ACTION}">`,
    );
    expect(html).toContain(
      '<input type="hidden" name="token" value="header.payload.signature">',
    );
    expect(html).toContain('<button type="submit">');
    expect(html).toContain(
      '<script nonce="bm9uY2U=">document.getElementById("handoff").submit();</script>',
    );
    expect(html).toContain('<meta name="referrer" content="strict-origin">');
  });

  it("keeps the token out of the action URL", () => {
    const html = renderHandoffPage({
      action: ACTION,
      token: "header.payload.signature",
      nonce: null,
    });

    expect(html).not.toMatch(/action="[^"]*header\.payload\.signature/);
  });

  it("renders no script without a nonce, so the button is the way on", () => {
    const html = renderHandoffPage({ action: ACTION, token: "t", nonce: null });

    expect(html).not.toContain("<script");
    expect(html).toContain('<button type="submit">');
  });

  it("escapes hostile values in every position", () => {
    const hostile = `"><script>alert(1)</script>`;
    const html = renderHandoffPage({
      action: hostile,
      token: hostile,
      nonce: hostile,
    });

    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).not.toContain(`"><script`);
    expect(html).toContain("&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;");
  });
});
```

Create `src/app/api/__tests__/billing-handoff.test.ts`. The real `getAuthUser` runs (only the session, Prisma and the API-key lookup are mocked), because the point is that the organization status is not consulted and that an API key never gets a token. `next/headers` is replaced so a test can present an `Authorization: Bearer at_...` header.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { jwtVerify, errors } from "jose";
import {
  TEST_CONTROL_PLANE_SECRET,
  stubCloudMode,
} from "../../../../tests/setup/cloud-mode";

// The real api-auth guards run here (session + org status): the point is that a
// locked or read-only org's admin still gets a token, and that an API key never does.
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }));

import { POST } from "@/app/api/billing/handoff/route";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { validateApiKey } from "@/lib/api-keys";
import { requireApiAuth } from "@/lib/api-auth";
import { deriveKey } from "@/lib/control-plane/keys";

const mockAuth = vi.mocked(auth, true);
const mockPrisma = vi.mocked(prisma, true);
const mockHeaders = vi.mocked(headers);
const mockValidateApiKey = vi.mocked(validateApiKey);

const APP_ORIGIN = "https://app.example.com";
const BILLING_ORIGIN = "https://billing.example.com";
const DAY_MS = 24 * 60 * 60 * 1000;

interface OrgRow {
  isActive: boolean;
  suspendedAt: Date | null;
  lockedAt: Date | null;
  entitlements: unknown;
}

function dbUser(
  overrides: {
    isadmin?: boolean;
    email?: string | null;
    organizationId?: string | null;
    organization?: Partial<OrgRow> | null;
  } = {},
) {
  const { organization, ...rest } = overrides;
  return {
    userid: "user-1",
    username: "jdoe",
    firstname: "Jane",
    lastname: "Doe",
    email: "jane@example.com",
    isadmin: true,
    canrequest: true,
    organizationId: "org-1",
    departmentId: null,
    isActive: true,
    organization:
      organization === null
        ? null
        : {
            isActive: true,
            suspendedAt: null,
            lockedAt: null,
            entitlements: null,
            ...organization,
          },
    ...rest,
  };
}

function handoffRequest(
  options: { origin?: string | null; nonce?: string } = {},
): NextRequest {
  const { origin = APP_ORIGIN, nonce } = options;
  const requestHeaders: Record<string, string> = {};
  if (origin !== null) requestHeaders.origin = origin;
  if (nonce) requestHeaders["x-nonce"] = nonce;
  return new NextRequest(`${APP_ORIGIN}/api/billing/handoff`, {
    method: "POST",
    headers: requestHeaders,
  });
}

/** The token field of the returned page. */
function tokenOf(html: string): string {
  const match = html.match(/name="token" value="([^"]+)"/);
  if (!match) throw new Error("no token field in the page");
  return match[1];
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCloudMode();
  vi.stubEnv("BETTER_AUTH_URL", APP_ORIGIN);
  vi.stubEnv("BILLING_URL", BILLING_ORIGIN);
  mockHeaders.mockResolvedValue(new Headers());
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1", isadmin: true },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue(dbUser() as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/billing/handoff availability", () => {
  it("answers 404 without BILLING_URL, before any auth work", async () => {
    vi.stubEnv("BILLING_URL", "");

    const response = await POST(handoffRequest());

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "Not found",
      code: "not_found",
    });
    expect(mockAuth.api.getSession).not.toHaveBeenCalled();
  });

  it("answers 404 outside cloud mode even when BILLING_URL is set (stale SaaS data)", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");

    const response = await POST(handoffRequest());

    expect(response.status).toBe(404);
    expect(mockAuth.api.getSession).not.toHaveBeenCalled();
  });

  it("answers 404 when BILLING_URL is not a bare https origin", async () => {
    vi.stubEnv("BILLING_URL", `${BILLING_ORIGIN}/some/path`);

    const response = await POST(handoffRequest());

    expect(response.status).toBe(404);
  });
});

describe("POST /api/billing/handoff authorization", () => {
  it("rejects a request without a session with 401", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);

    const response = await POST(handoffRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "unauthorized" });
  });

  it("rejects an API key with 403 session_required", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );
    // The key's organization holds api_keys, so the key authenticates (Task 7's
    // use-time gate passes) and the route itself refuses it.
    mockValidateApiKey.mockResolvedValue({
      id: "key-1",
      scopes: ["settings:edit"],
      user: dbUser({
        organization: {
          entitlements: {
            features: ["api_keys"],
            maxAssets: null,
            maxUsers: null,
          },
        },
      }),
    } as never);

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body).toMatchObject({ code: "session_required" });
    expect(JSON.stringify(body)).not.toContain("eyJ");
    expect(mockAuth.api.getSession).not.toHaveBeenCalled();
  });

  it("rejects an API key of an organization without api_keys and issues no token", async () => {
    mockHeaders.mockResolvedValue(
      new Headers({ authorization: "Bearer at_test_key" }),
    );
    mockValidateApiKey.mockResolvedValue({
      id: "key-1",
      scopes: ["settings:edit"],
      user: dbUser(),
    } as never);

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    expect(JSON.stringify(await response.json())).not.toContain("eyJ");
  });

  it("rejects a non-admin with 403 not_admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
  });

  it("rejects a demoted admin whose session still says admin", async () => {
    mockAuth.api.getSession.mockResolvedValue({
      user: { id: "user-1", isadmin: true },
    } as never);
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ isadmin: false }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
  });

  it("rejects a deactivated admin with 401", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...dbUser(),
      isActive: false,
    } as never);

    const response = await POST(handoffRequest());

    expect(response.status).toBe(401);
  });

  it.each([
    ["a foreign origin", "https://evil.example.com"],
    ["another scheme", "http://app.example.com"],
    ["another port", "https://app.example.com:8443"],
    ["the literal null origin", "null"],
    ["the billing origin", BILLING_ORIGIN],
  ])("rejects %s with 403 bad_origin", async (_label, origin) => {
    const response = await POST(handoffRequest({ origin }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "bad_origin" });
  });

  it("rejects a request without an Origin header with 403 bad_origin", async () => {
    const response = await POST(handoffRequest({ origin: null }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "bad_origin" });
  });

  it("compares the Origin with the app origin even when BETTER_AUTH_URL has a path", async () => {
    vi.stubEnv("BETTER_AUTH_URL", `${APP_ORIGIN}/`);

    const response = await POST(handoffRequest({ origin: APP_ORIGIN }));

    expect(response.status).toBe(200);
  });

  it("rejects an admin without an organization with 403 organization_required", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organizationId: null, organization: null }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      code: "organization_required",
    });
  });

  it("rejects an admin without an email address with 403 not_admin", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ email: null }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "not_admin" });
  });
});

describe("POST /api/billing/handoff response", () => {
  it("answers an admin with the form page and no-store and strict-origin headers", async () => {
    const response = await POST(handoffRequest({ nonce: "bm9uY2U=" }));
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("referrer-policy")).toBe("strict-origin");
    expect(html).toContain(`action="${BILLING_ORIGIN}/handoff"`);
    expect(html).toContain('method="post"');
    expect(html).toContain('<script nonce="bm9uY2U=">');
  });

  it("renders no script when the proxy supplied no nonce", async () => {
    const response = await POST(handoffRequest());

    expect(await response.text()).not.toContain("<script");
  });

  it("signs the admin's id, organization and email into the token", async () => {
    const response = await POST(handoffRequest());
    const token = tokenOf(await response.text());

    const { payload } = await jwtVerify(
      token,
      deriveKey("handoff-v1", TEST_CONTROL_PLANE_SECRET),
      { issuer: APP_ORIGIN, audience: "billing-handoff" },
    );
    expect(payload).toMatchObject({
      sub: "user-1",
      orgId: "org-1",
      email: "jane@example.com",
    });
    expect(payload.exp).toBe((payload.iat ?? 0) + 60);
  });

  it("issues a token that is dead after 60 seconds", async () => {
    const response = await POST(handoffRequest());
    const token = tokenOf(await response.text());

    await expect(
      jwtVerify(token, deriveKey("handoff-v1", TEST_CONTROL_PLANE_SECRET), {
        currentDate: new Date(Date.now() + 61_000),
      }),
    ).rejects.toBeInstanceOf(errors.JWTExpired);
  });

  it("gives a locked-out organization's admin a token (the status block is skipped)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organization: { lockedAt: new Date() } }) as never,
    );
    // The same fixture is refused by the regular guard, so the 200 below is the skip.
    await expect(requireApiAuth()).rejects.toMatchObject({
      code: "org_locked",
    });

    const response = await POST(handoffRequest());

    expect(response.status).toBe(200);
    expect(tokenOf(await response.text())).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  it("gives a past-grace suspended organization's admin a token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({
        organization: { suspendedAt: new Date(Date.now() - 30 * DAY_MS) },
      }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(200);
  });

  it("gives a read-only organization's admin a token", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(
      dbUser({ organization: { suspendedAt: new Date() } }) as never,
    );

    const response = await POST(handoffRequest());

    expect(response.status).toBe(200);
  });

  it("never puts the token in a redirect, a header or the form action", async () => {
    const response = await POST(handoffRequest());
    const html = await response.text();
    const token = tokenOf(html);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    for (const [, value] of response.headers) {
      expect(value).not.toContain(token);
    }
    const action = html.match(/<form [^>]*action="([^"]+)"/)?.[1] ?? "";
    expect(action).toBe(`${BILLING_ORIGIN}/handoff`);
    expect(action).not.toContain("?");
    expect(action).not.toContain(token);
  });

  it("answers 500 with a generic body when something unexpected fails", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(
      new Error("connection to db.internal:5432 refused"),
    );

    const response = await POST(handoffRequest());
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toEqual({
      error: "Failed to start the billing handoff",
      code: "internal_error",
    });
    expect(text).not.toContain("db.internal");
  });
});
```

Create `src/app/__tests__/suspended-page.test.ts`. The page is an async server component: the test awaits it and renders the element to static markup. The sign-out button is a client component and is replaced by a stub.

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { stubCloudMode } from "../../../tests/setup/cloud-mode";

vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock("@/app/suspended/SignOutButton", () => ({ default: () => null }));

import SuspendedPage from "@/app/suspended/page";
import { auth } from "@/lib/auth";

const mockAuth = vi.mocked(auth, true);

const HANDOFF_FORM = 'action="/api/billing/handoff"';
const PORTAL_FORM = 'action="/api/billing/portal"';
const CONTACT_TEXT = "Contact your administrator or support";

async function render(): Promise<string> {
  return renderToStaticMarkup(await SuspendedPage());
}

function signIn(isadmin: boolean): void {
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "user-1", isadmin },
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  stubCloudMode();
  vi.stubEnv("BILLING_URL", "");
  vi.stubEnv("STRIPE_SECRET_KEY", "");
  signIn(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("/suspended billing entry", () => {
  it("offers an admin the billing handoff when BILLING_URL is set", async () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com");

    const html = await render();

    expect(html).toContain(HANDOFF_FORM);
    expect(html).toContain("Manage billing");
    expect(html).toContain('method="post"');
    expect(html).not.toContain(PORTAL_FORM);
    expect(html).not.toContain(CONTACT_TEXT);
  });

  it("prefers the handoff over the Stripe portal while both are configured", async () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const html = await render();

    expect(html).toContain(HANDOFF_FORM);
    expect(html).not.toContain(PORTAL_FORM);
  });

  it("offers an admin the legacy Stripe portal while legacy billing is active", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const html = await render();

    expect(html).toContain(PORTAL_FORM);
    expect(html).toContain("Manage subscription");
    expect(html).not.toContain(HANDOFF_FORM);
  });

  it("falls back to the Stripe portal when BILLING_URL is invalid", async () => {
    vi.stubEnv("BILLING_URL", "https://billing.example.com/not-an-origin");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const html = await render();

    expect(html).toContain(PORTAL_FORM);
    expect(html).not.toContain(HANDOFF_FORM);
  });

  it("tells an admin to contact support when no billing path exists", async () => {
    const html = await render();

    expect(html).toContain(CONTACT_TEXT);
    expect(html).not.toContain("<form");
  });

  it("tells a non-admin to contact an administrator even when billing exists", async () => {
    signIn(false);
    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const html = await render();

    expect(html).toContain(CONTACT_TEXT);
    expect(html).not.toContain(HANDOFF_FORM);
    expect(html).not.toContain(PORTAL_FORM);
  });

  it("shows no billing form without a session", async () => {
    mockAuth.api.getSession.mockResolvedValue(null as never);
    vi.stubEnv("BILLING_URL", "https://billing.example.com");

    const html = await render();

    expect(html).toContain(CONTACT_TEXT);
    expect(html).not.toContain(HANDOFF_FORM);
  });

  it("shows no billing form outside cloud mode, whatever is configured", async () => {
    vi.stubEnv("CONTROL_PLANE_SECRET", "");
    vi.stubEnv("BILLING_URL", "https://billing.example.com");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    const html = await render();

    expect(html).toContain(CONTACT_TEXT);
    expect(html).not.toContain(HANDOFF_FORM);
    expect(html).not.toContain(PORTAL_FORM);
  });
});
```

Exempt the new route from the "calls requireWritableOrg in every mutating handler" rule, like the other billing routes (a locked admin must be able to start billing). The "keeps the exemption list honest" test then fails until the route exists.

In `src/app/api/__tests__/route-conventions.test.ts`, add the entry to `WRITE_GUARD_EXEMPT` next to the other billing routes.

Replace:

```ts
  "billing/checkout/route.ts",
```

With:

```ts
  "billing/checkout/route.ts",
  "billing/handoff/route.ts",
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/handoff.test.ts src/app/api/__tests__/billing-handoff.test.ts src/app/__tests__/suspended-page.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: FAIL. `handoff.test.ts` and `billing-handoff.test.ts` cannot load `@/lib/control-plane/handoff` and `@/app/api/billing/handoff/route`; `suspended-page.test.ts` fails its handoff cases (the page still posts to the Stripe portal and ignores `BILLING_URL`); `route-conventions.test.ts` fails "keeps the exemption list honest" with `billing/handoff/route.ts` listed.

- [ ] **Step 8: Write the token and the page**

Create `src/lib/control-plane/handoff.ts`. The key is derived for this purpose only (`deriveKey("handoff-v1")`), so a token can never be replayed as an event signature and the control plane secret itself never leaves the core. The page has a visible button next to the script: with no nonce (the proxy did not run) the button is the way on.

```ts
import { randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { getAppOrigin } from "@/lib/app-origin";
import { deriveKey } from "@/lib/control-plane/keys";
import { escapeHtml } from "@/lib/html-escape";

/** The audience the control plane must require when it verifies a token. */
export const HANDOFF_AUDIENCE = "billing-handoff";

/** A handoff token is good for one minute. */
export const HANDOFF_TTL_SECONDS = 60;

export interface HandoffClaims {
  userId: string;
  orgId: string;
  email: string;
}

/**
 * A short-lived HS256 token that proves to the control plane which admin of
 * which organization asked for billing. The key is derived from
 * CONTROL_PLANE_SECRET for this purpose only; the secret itself never leaves
 * the core. The control plane rejects a reused `jti`.
 */
export async function signHandoffToken(
  claims: HandoffClaims,
  now: Date = new Date(),
): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  return new SignJWT({ orgId: claims.orgId, email: claims.email })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(getAppOrigin())
    .setAudience(HANDOFF_AUDIENCE)
    .setSubject(claims.userId)
    .setJti(randomUUID())
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + HANDOFF_TTL_SECONDS)
    .sign(deriveKey("handoff-v1"));
}

export interface HandoffPageInput {
  /** Where the form posts to: the control plane's handoff endpoint. */
  action: string;
  token: string;
  /** The CSP nonce of this response; without one the visible button is the only way on. */
  nonce: string | null;
}

/**
 * The page that carries the token to the control plane in a POST body, so the
 * token is never part of a URL, a Location header or a Referer. The script
 * submits the form straight away; the button covers a blocked script.
 */
export function renderHandoffPage({
  action,
  token,
  nonce,
}: HandoffPageInput): string {
  const script =
    nonce === null
      ? ""
      : `<script nonce="${escapeHtml(nonce)}">document.getElementById("handoff").submit();</script>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="referrer" content="strict-origin">
<meta name="robots" content="noindex">
<title>Opening billing</title>
</head>
<body>
<p>Opening billing...</p>
<form id="handoff" method="post" action="${escapeHtml(action)}">
<input type="hidden" name="token" value="${escapeHtml(token)}">
<button type="submit">Continue to billing</button>
</form>
${script}
</body>
</html>
`;
}
```

- [ ] **Step 9: Write the route**

Create `src/app/api/billing/handoff/route.ts`. Order matters and is pinned by the tests: availability (404) first, then authentication, then the API-key refusal, the admin check, the `Origin` check, the organization and the email.

```ts
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/api-auth";
import { getAppOrigin } from "@/lib/app-origin";
import {
  renderHandoffPage,
  signHandoffToken,
} from "@/lib/control-plane/handoff";
import { getBillingOrigin } from "@/lib/csp";
import { isCloudMode } from "@/lib/deployment-mode";
import { apiErrorResponse, ForbiddenError } from "@/lib/errors";
import { logger } from "@/lib/logger";

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "strict-origin",
} as const;

function notFound(): NextResponse {
  return NextResponse.json(
    { error: "Not found", code: "not_found" },
    { status: 404 },
  );
}

/**
 * Starts "Manage billing": answers with a page that posts a short-lived signed
 * token to the control plane. Only a browser session of an admin may start it,
 * from the app's own origin.
 */
export async function POST(req: Request) {
  try {
    // Without a control plane (or a valid BILLING_URL) this route does not exist.
    const billingOrigin = isCloudMode() ? getBillingOrigin() : null;
    if (!billingOrigin) return notFound();

    // getAuthUser (not requireApiAuth) on purpose: admins of a read-only or
    // locked-out organization must still be able to reach billing and pay.
    const user = await getAuthUser();
    if (user.apiKeyId) {
      throw new ForbiddenError(
        "session_required",
        "A browser session is required",
      );
    }
    if (!user.isAdmin) {
      throw new ForbiddenError("not_admin", "Admin access required");
    }
    // Defence in depth next to the SameSite cookie: a missing Origin is refused too.
    if (req.headers.get("origin") !== getAppOrigin()) {
      throw new ForbiddenError("bad_origin", "Request origin not allowed");
    }
    if (!user.organizationId) {
      throw new ForbiddenError(
        "organization_required",
        "An organization is required",
      );
    }
    if (!user.id || !user.email) {
      throw new ForbiddenError(
        "not_admin",
        "An admin email address is required",
      );
    }

    const token = await signHandoffToken({
      userId: user.id,
      orgId: user.organizationId,
      email: user.email,
    });
    const html = renderHandoffPage({
      action: `${billingOrigin}/handoff`,
      token,
      nonce: req.headers.get("x-nonce"),
    });
    return new NextResponse(html, { status: 200, headers: HTML_HEADERS });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("Billing handoff error", { error });
    return NextResponse.json(
      { error: "Failed to start the billing handoff", code: "internal_error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 10: Update the suspended page**

`/suspended` is public and renders for locked and read-only members. The decision is a small page-local function; the control plane's handoff wins over the legacy Stripe portal while both are configured (spec Revision 3).

In `src/app/suspended/page.tsx`, add the imports.

Replace:

```tsx
import { Button } from "@/components/ui/button";
import SignOutButton from "./SignOutButton";
```

With:

```tsx
import { Button } from "@/components/ui/button";
import { getBillingOrigin } from "@/lib/csp";
import { isCloudMode } from "@/lib/deployment-mode";
import { isLegacyBillingActive } from "@/lib/legacy-billing";
import SignOutButton from "./SignOutButton";
```

In `src/app/suspended/page.tsx`, replace the billing flag with the decision function.

Replace:

```tsx
export default async function SuspendedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const canManageBilling =
    !!session?.user?.isadmin && !!process.env.STRIPE_SECRET_KEY;
```

With:

```tsx
type BillingAction = "handoff" | "portal" | "contact";

/**
 * What an admin can do about a suspended organization. The control plane's
 * handoff (BILLING_URL) wins over the legacy Stripe portal while both exist;
 * everyone else is told to contact an administrator.
 */
function resolveBillingAction(isAdmin: boolean): BillingAction {
  if (!isAdmin || !isCloudMode()) return "contact";
  if (getBillingOrigin() !== null) return "handoff";
  return isLegacyBillingActive() ? "portal" : "contact";
}

export default async function SuspendedPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const billingAction = resolveBillingAction(!!session?.user?.isadmin);
```

In `src/app/suspended/page.tsx`, replace the button block.

Replace:

```tsx
{
  canManageBilling ? (
    <form method="post" action="/api/billing/portal">
      <Button type="submit" className="w-full">
        Manage subscription
      </Button>
    </form>
  ) : (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      Contact your administrator or support to reactivate this organization.
    </p>
  );
}
```

With:

```tsx
{
  billingAction === "handoff" && (
    <form method="post" action="/api/billing/handoff">
      <Button type="submit" className="w-full">
        Manage billing
      </Button>
    </form>
  );
}
{
  billingAction === "portal" && (
    <form method="post" action="/api/billing/portal">
      <Button type="submit" className="w-full">
        Manage subscription
      </Button>
    </form>
  );
}
{
  billingAction === "contact" && (
    <p className="text-sm text-gray-600 dark:text-gray-400">
      Contact your administrator or support to reactivate this organization.
    </p>
  );
}
```

- [ ] **Step 11: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/lib/__tests__/handoff.test.ts src/app/api/__tests__/billing-handoff.test.ts src/app/__tests__/suspended-page.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .` and `npx eslint src/lib/control-plane/handoff.ts src/app/api/billing/handoff/route.ts src/app/suspended/page.tsx src/lib/__tests__/handoff.test.ts src/app/api/__tests__/billing-handoff.test.ts src/app/__tests__/suspended-page.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: no errors.

The task changed `src/proxy.ts` and `src/lib/email/templates.ts`, which many suites touch: run `npx vitest run`.
Expected: all pass (DB tests skipped locally).

- [ ] **Step 12: Commit**

```bash
git add src/lib/control-plane/handoff.ts src/app/api/billing/handoff/route.ts src/app/suspended/page.tsx src/app/api/__tests__/route-conventions.test.ts src/lib/__tests__/handoff.test.ts src/app/api/__tests__/billing-handoff.test.ts src/app/__tests__/suspended-page.test.ts
git commit -m "feat: add the billing handoff route and the suspended page entry"
```
