### Task 8: Custom field and workflow automation gates

Custom fields and workflow automation both follow the revoked-feature rule: create and edit are blocked; list, deactivate and delete stay open; data that already exists stays readable. Custom field values are written after the entity is saved, so the value route blocks writes while `GET /api/custom-fields/values` keeps answering and tells the form section whether it may render inputs. The workflow engine has no request user, so it reads the organization's access by id with a per-run memo.

**Files:**

- Create: `src/lib/custom-fields-editable.ts`
- Modify: `src/app/api/admin/custom-fields/route.ts`
- Modify: `src/app/api/admin/custom-fields/[id]/route.ts`
- Modify: `src/app/api/custom-fields/values/route.ts`
- Modify: `src/components/CustomFieldsSection.tsx`
- Modify: `src/app/api/admin/workflows/route.ts`
- Modify: `src/app/api/admin/workflows/[id]/route.ts`
- Modify: `src/lib/workflow-engine.ts`
- Test: `src/lib/__tests__/custom-fields-editable.test.ts` (create)
- Test: `src/components/__tests__/custom-fields-section.test.ts` (create; static scan)
- Test: `src/app/api/__tests__/custom-fields-scope.test.ts` (extend)
- Test: `src/app/api/__tests__/workflows-scope.test.ts` (extend)
- Test: `src/lib/__tests__/workflow-engine.test.ts` (update the org-status mock and tests)
- Test: `src/app/api/__tests__/entitlement-gates-matrix.test.ts` (create; Part C, covers the routes of Tasks 7 and 8)

**Interfaces:**

- Consumes (Task 6): `requireFeature(user, feature)` from `@/lib/api-auth` (and its automock export); `allowsFeature` from `@/lib/entitlements-shared`; `getEffectiveEntitlements` from `@/lib/entitlements`; `getCachedOrgAccess`, `type OrgAccess`, `type OrgAccessCache` from `@/lib/org-access`; `AuthUser.entitlements?`. Consumes (Task 1): `EntitlementError`. Consumes (Task 2): `stubCloudMode()` from `tests/setup/cloud-mode.ts`.
- Produces `GET /api/custom-fields/values` header `X-Custom-Fields-Editable: "1" | "0"` (the body stays a bare array).
- Produces in `src/lib/custom-fields-editable.ts` (client-safe, no server imports): `CUSTOM_FIELDS_EDITABLE_HEADER = "X-Custom-Fields-Editable"`, `editableHeaderValue(editable: boolean): "1" | "0"`, `isEditableFromHeader(value: string | null): boolean` (only an explicit `"0"` means read-only; a missing header leaves editing on, and the value route still enforces the gate on save).
- Produces `processWorkflowTrigger(trigger, data, organizationId, accessCache: OrgAccessCache = new Map())` (the fourth parameter changes type from `Map<string, OrgStatus>`). `getOrgSuspensionStatus` has no caller left after this task and Task 9; it stays exported.

Decisions for this task:

- Definitions: `POST` and `PUT` require `custom_fields`; `PATCH` requires it only when it sets `isActive: true`; `GET` and `DELETE` stay open. A definition is deactivated with `PATCH`, which is how the admin tab toggles it; `PUT` is a full edit and is always gated.
- Values: `POST` requires `custom_fields`; `GET` stays open for every member.
- Rules: `POST` requires `workflow_automation`; `PUT` requires it unless the validated body is exactly `{ isActive: false }`; `GET` and `DELETE` stay open.
- The engine skips a locked-out organization first, then an organization without `workflow_automation`. Both skips are silent: the engine runs once per matching record and would flood the log.
- The value route computes the header from `user.entitlements` (loaded with the user by Task 6) and only falls back to `getEffectiveEntitlements` for a user object that carries none.
- Review Focus 4 (revocation keeps data usable): after a revocation definitions stay listable, deactivatable and deletable, rules stay listable, deactivatable and deletable, and stored custom field values stay readable (the section renders them as text). Review Focus 1 (stale SaaS data in a deployment without a control plane) is pinned for every gated route of Tasks 7 and 8 by the matrix test in Part C.

#### Part A: custom fields

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/custom-fields-editable.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  CUSTOM_FIELDS_EDITABLE_HEADER,
  editableHeaderValue,
  isEditableFromHeader,
} from "@/lib/custom-fields-editable";

describe("custom field editability header", () => {
  it("uses one header name for the route and the form section", () => {
    expect(CUSTOM_FIELDS_EDITABLE_HEADER).toBe("X-Custom-Fields-Editable");
  });

  it("encodes the answer as 1 or 0", () => {
    expect(editableHeaderValue(true)).toBe("1");
    expect(editableHeaderValue(false)).toBe("0");
  });

  it.each([
    ["1", true],
    ["0", false],
    [null, true],
    ["", true],
    ["no", true],
  ])("reads %j as editable=%s", (value, expected) => {
    expect(isEditableFromHeader(value)).toBe(expected);
  });
});
```

Create `src/components/__tests__/custom-fields-section.test.ts`. The repo has no component test setup (vitest only collects `.test.ts` in the node environment), so this is a static scan in the style of `server-pages-static-scope.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(
  path.resolve(__dirname, "../CustomFieldsSection.tsx"),
  "utf8",
);

describe("CustomFieldsSection editability", () => {
  it("reads the editable header from the values response", () => {
    expect(source).toContain("CUSTOM_FIELDS_EDITABLE_HEADER");
    expect(source).toContain("isEditableFromHeader(");
  });

  it("starts editable and falls back to the read-only branch when told to", () => {
    expect(source).toMatch(/\[editable, setEditable\] = useState\(true\)/);
    expect(source).toMatch(/if \(readOnly \|\| !editable\) \{/);
  });
});
```

In `src/app/api/__tests__/custom-fields-scope.test.ts`, replace:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";
```

with:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";
```

and replace:

```ts
import {
  requireApiAdmin,
  requireApiAuth,
  requireWritableOrg,
} from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireApiAuth,
  requireFeature,
  requireWritableOrg,
} from "@/lib/api-auth";
```

and replace:

```ts
import { createCustomFieldDefinitionSchema } from "@/lib/validation";
```

with:

```ts
import { createCustomFieldDefinitionSchema } from "@/lib/validation";
import { EntitlementError } from "@/lib/errors";
import type { Entitlements } from "@/lib/entitlements-shared";
```

and, in the file-level `beforeEach`, replace:

```ts
vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
vi.mocked(getOrganizationContext).mockResolvedValue({
  organization: { id: OWN_ORG },
} as never);
vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(true);
```

with:

```ts
vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
vi.mocked(requireFeature).mockReset();
vi.mocked(requireFeature).mockResolvedValue(undefined);
vi.mocked(getOrganizationContext).mockResolvedValue({
  organization: { id: OWN_ORG },
} as never);
vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(true);
```

Append to `src/app/api/__tests__/custom-fields-scope.test.ts`:

```ts
describe("custom_fields entitlement", () => {
  const GRANTED: Entitlements = {
    features: ["custom_fields"],
    maxAssets: 100,
    maxUsers: 3,
  };
  const REVOKED: Entitlements = {
    features: ["api_keys"],
    maxAssets: 100,
    maxUsers: 3,
  };

  const denyOnce = () =>
    vi
      .mocked(requireFeature)
      .mockRejectedValueOnce(new EntitlementError("custom_fields"));

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("definitions", () => {
    const definitionBody = {
      name: "Cost centre",
      fieldType: "text",
      entityType: "asset",
      isRequired: false,
      displayOrder: 0,
    };

    const send = (
      handler: typeof PUT | typeof PATCH,
      method: "PUT" | "PATCH",
      body: Record<string, unknown>,
    ) =>
      handler(
        createMockRequest(`/api/admin/custom-fields/${OWN_FIELD}`, {
          method,
          body,
        }),
        params(OWN_FIELD),
      );

    it("POST requires the feature and creates nothing without it", async () => {
      denyOnce();

      const res = await POST(
        createMockRequest("/api/admin/custom-fields", {
          method: "POST",
          body: definitionBody,
        }),
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        code: "feature_not_entitled",
        feature: "custom_fields",
      });
      expect(requireFeature).toHaveBeenCalledWith(caller, "custom_fields");
      expect(mockPrisma.custom_field_definitions.create).not.toHaveBeenCalled();
    });

    it("POST creates the definition when the feature is granted", async () => {
      const res = await POST(
        createMockRequest("/api/admin/custom-fields", {
          method: "POST",
          body: definitionBody,
        }),
      );

      expect(res.status).toBe(201);
      expect(requireFeature).toHaveBeenCalledWith(caller, "custom_fields");
    });

    it("PUT requires the feature and updates nothing without it", async () => {
      denyOnce();

      const res = await send(PUT, "PUT", { name: "Renamed" });

      expect(res.status).toBe(403);
      expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
    });

    it("PATCH requires the feature to switch a definition on", async () => {
      denyOnce();

      const res = await send(PATCH, "PATCH", { isActive: true });

      expect(res.status).toBe(403);
      expect(requireFeature).toHaveBeenCalledWith(caller, "custom_fields");
      expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
    });

    it("PATCH lets a definition be switched off without the feature", async () => {
      const res = await send(PATCH, "PATCH", { isActive: false });

      expect(res.status).toBe(200);
      expect(requireFeature).not.toHaveBeenCalled();
      expect(mockPrisma.custom_field_definitions.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: OWN_FIELD },
          data: expect.objectContaining({ isActive: false }),
        }),
      );
    });

    it("DELETE stays open", async () => {
      const res = await DELETE(
        createMockRequest(`/api/admin/custom-fields/${OWN_FIELD}`, {
          method: "DELETE",
        }),
        params(OWN_FIELD),
      );

      expect(res.status).toBe(200);
      expect(requireFeature).not.toHaveBeenCalled();
      expect(mockPrisma.custom_field_definitions.delete).toHaveBeenCalled();
    });

    it("GET (the list) stays open", async () => {
      const res = await GET();

      expect(res.status).toBe(200);
      expect(requireFeature).not.toHaveBeenCalled();
    });
  });

  describe("values", () => {
    const get = () =>
      GET_VALUES(
        createMockRequest(
          `/api/custom-fields/values?entityType=asset&entityId=${ENTITY_ID}`,
        ),
      );

    it("POST requires the feature and writes nothing without it", async () => {
      denyOnce();

      const res = await POST_VALUES(
        createMockRequest("/api/custom-fields/values", {
          method: "POST",
          body: {
            entityId: ENTITY_ID,
            entityType: "asset",
            values: { [OWN_FIELD]: "CC-1" },
          },
        }),
      );

      expect(res.status).toBe(403);
      expect(await res.json()).toMatchObject({
        code: "feature_not_entitled",
        feature: "custom_fields",
      });
      expect(requireFeature).toHaveBeenCalledWith(caller, "custom_fields");
      expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
    });

    it("GET marks the answer editable while the organization has custom fields", async () => {
      stubCloudMode();
      vi.mocked(requireApiAuth).mockResolvedValue({
        ...caller,
        entitlements: GRANTED,
      } as never);

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Custom-Fields-Editable")).toBe("1");
      expect(Array.isArray(await res.json())).toBe(true);
    });

    it("GET keeps answering after a revocation and marks the answer read-only", async () => {
      stubCloudMode();
      vi.mocked(requireApiAuth).mockResolvedValue({
        ...caller,
        entitlements: REVOKED,
      } as never);
      mockPrisma.custom_field_values.findMany.mockResolvedValue([
        { fieldId: OWN_FIELD, value: "CC-1" },
      ] as never);

      const res = await get();

      expect(res.status).toBe(200);
      expect(res.headers.get("X-Custom-Fields-Editable")).toBe("0");
      expect(requireFeature).not.toHaveBeenCalled();
      const body = (await res.json()) as Array<{
        id: string;
        value: string | null;
      }>;
      expect(body.map((d) => d.id)).toEqual([OWN_FIELD, OWN_FIELD_2]);
      expect(body[0]?.value).toBe("CC-1");
    });

    it("GET falls back to the effective entitlements: editable outside cloud mode", async () => {
      // The default caller carries no entitlements. Without a control plane
      // everything is unrestricted, whatever is stored.
      const res = await get();

      expect(res.headers.get("X-Custom-Fields-Editable")).toBe("1");
    });

    it("GET marks a user without an organization read-only in cloud mode", async () => {
      stubCloudMode();
      orgless();

      const res = await get();

      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
      expect(res.headers.get("X-Custom-Fields-Editable")).toBe("0");
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/__tests__/custom-fields-editable.test.ts src/components/__tests__/custom-fields-section.test.ts src/app/api/__tests__/custom-fields-scope.test.ts`
Expected: FAIL. `@/lib/custom-fields-editable` does not exist, the section does not read the header, the definition and value routes never call `requireFeature`, and the values answer carries no header.

- [ ] **Step 3: Write the shared header helpers**

Create `src/lib/custom-fields-editable.ts`:

```ts
/**
 * Whether the signed-in user's organization may still write custom field
 * values. GET /api/custom-fields/values sends the answer in this header so the
 * response body can stay a bare array; the form section falls back to its
 * read-only rendering when it reads "0". Client-safe: no server imports.
 */
export const CUSTOM_FIELDS_EDITABLE_HEADER = "X-Custom-Fields-Editable";

export function editableHeaderValue(editable: boolean): "1" | "0" {
  return editable ? "1" : "0";
}

/**
 * Only an explicit "0" means read-only. A missing header leaves editing on:
 * the value route enforces the gate when the values are saved anyway.
 */
export function isEditableFromHeader(value: string | null): boolean {
  return value !== "0";
}
```

- [ ] **Step 4: Gate the definition routes**

In `src/app/api/admin/custom-fields/route.ts`, replace:

```ts
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireFeature,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

and replace:

```ts
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create custom fields" },
```

with:

```ts
    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    await requireFeature(user, "custom_fields");

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create custom fields" },
```

In `src/app/api/admin/custom-fields/[id]/route.ts`, replace:

```ts
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireFeature,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

and replace (PUT):

```ts
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
```

with:

```ts
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    await requireFeature(user, "custom_fields");
```

and replace (PATCH):

```ts
const body = await request.json();
const validated = validateBody(toggleCustomFieldDefinitionSchema, body);
if (validated instanceof NextResponse) return validated;
```

with:

```ts
const body = await request.json();
const validated = validateBody(toggleCustomFieldDefinitionSchema, body);
if (validated instanceof NextResponse) return validated;

// Switching a definition off stays possible after a revocation; switching
// it on is configuration.
if (validated.isActive) {
  await requireFeature(user, "custom_fields");
}
```

- [ ] **Step 5: Gate the value route and send the editability header**

In `src/app/api/custom-fields/values/route.ts`, replace:

```ts
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { verifyEntityOrgOwnership } from "@/lib/organization-context";
import { isGuid } from "@/lib/validation";

export async function GET(request: NextRequest) {
```

with:

```ts
import {
  requireApiAuth,
  requireFeature,
  requireNotDemoMode,
  requireWritableOrg,
  type AuthUser,
} from "@/lib/api-auth";
import {
  CUSTOM_FIELDS_EDITABLE_HEADER,
  editableHeaderValue,
} from "@/lib/custom-fields-editable";
import { getEffectiveEntitlements } from "@/lib/entitlements";
import { allowsFeature } from "@/lib/entitlements-shared";
import { apiErrorResponse } from "@/lib/errors";
import prisma from "@/lib/prisma";
import { verifyEntityOrgOwnership } from "@/lib/organization-context";
import { isGuid } from "@/lib/validation";

/**
 * True when the user's organization may still write custom field values. Uses
 * the entitlements loaded with the user; only a user object without them
 * falls back to a read by organization id.
 */
async function canEditCustomFields(user: AuthUser): Promise<boolean> {
  const entitlements =
    user.entitlements ??
    (await getEffectiveEntitlements(user.organizationId ?? null));
  return allowsFeature(entitlements, "custom_fields");
}

export async function GET(request: NextRequest) {
```

and replace:

```ts
// A user without an organization owns no entities and no definitions.
// Never pass an undefined organizationId to Prisma: it would drop the
// filter and match every org.
const orgId = user.organizationId;
if (!orgId) return NextResponse.json([]);
```

with:

```ts
// Existing values stay readable after a revocation. The header tells the
// form section to render them without inputs.
const editableHeaders = {
  [CUSTOM_FIELDS_EDITABLE_HEADER]: editableHeaderValue(
    await canEditCustomFields(user),
  ),
};

// A user without an organization owns no entities and no definitions.
// Never pass an undefined organizationId to Prisma: it would drop the
// filter and match every org.
const orgId = user.organizationId;
if (!orgId) return NextResponse.json([], { headers: editableHeaders });
```

and replace:

```ts
    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to fetch custom field values" },
```

with:

```ts
    return NextResponse.json(result, { headers: editableHeaders });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    return NextResponse.json(
      { error: "Failed to fetch custom field values" },
```

and replace (POST):

```ts
    const user = await requireApiAuth();
    await requireWritableOrg(user);

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to save custom field values" },
```

with:

```ts
    const user = await requireApiAuth();
    await requireWritableOrg(user);
    await requireFeature(user, "custom_fields");

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to save custom field values" },
```

- [ ] **Step 6: Make the form section follow the header**

In `src/components/CustomFieldsSection.tsx`, replace:

```tsx
import { parseCustomFieldOptions } from "@/lib/custom-field-options";
```

with:

```tsx
import { parseCustomFieldOptions } from "@/lib/custom-field-options";
import {
  CUSTOM_FIELDS_EDITABLE_HEADER,
  isEditableFromHeader,
} from "@/lib/custom-fields-editable";
```

and replace:

```tsx
  const [loading, setLoading] = useState(true);

  const fetchFields = useCallback(async () => {
```

with:

```tsx
  const [loading, setLoading] = useState(true);
  // False once the organization lost the custom_fields feature: existing
  // values are shown as text and no input is offered.
  const [editable, setEditable] = useState(true);

  const fetchFields = useCallback(async () => {
```

and replace:

```tsx
      if (res.ok) {
        const data: CustomField[] = await res.json();
        setFields(data);
```

with:

```tsx
      if (res.ok) {
        setEditable(
          isEditableFromHeader(res.headers.get(CUSTOM_FIELDS_EDITABLE_HEADER)),
        );
        const data: CustomField[] = await res.json();
        setFields(data);
```

and replace:

```tsx
          if (readOnly) {
```

with:

```tsx
          if (readOnly || !editable) {
```

- [ ] **Step 7: Run the tests, the type check and the linter**

Run: `npx vitest run src/lib/__tests__/custom-fields-editable.test.ts src/components/__tests__/custom-fields-section.test.ts src/app/api/__tests__/custom-fields-scope.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/lib/custom-fields-editable.ts src/app/api/admin/custom-fields/route.ts "src/app/api/admin/custom-fields/[id]/route.ts" src/app/api/custom-fields/values/route.ts src/components/CustomFieldsSection.tsx src/lib/__tests__/custom-fields-editable.test.ts src/components/__tests__/custom-fields-section.test.ts src/app/api/__tests__/custom-fields-scope.test.ts`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/custom-fields-editable.ts src/app/api/admin/custom-fields/route.ts "src/app/api/admin/custom-fields/[id]/route.ts" src/app/api/custom-fields/values/route.ts src/components/CustomFieldsSection.tsx src/lib/__tests__/custom-fields-editable.test.ts src/components/__tests__/custom-fields-section.test.ts src/app/api/__tests__/custom-fields-scope.test.ts
git commit -m "feat: gate custom field definitions and values by entitlement"
```

#### Part B: workflow automation

- [ ] **Step 9: Write the failing route tests**

In `src/app/api/__tests__/workflows-scope.test.ts`, replace:

```ts
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireFeature,
  requireWritableOrg,
} from "@/lib/api-auth";
import { EntitlementError } from "@/lib/errors";
```

and, in the file-level `beforeEach`, replace:

```ts
vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
```

with:

```ts
vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
vi.mocked(requireFeature).mockReset();
vi.mocked(requireFeature).mockResolvedValue(undefined);
```

Append to `src/app/api/__tests__/workflows-scope.test.ts`:

```ts
describe("workflow_automation entitlement", () => {
  const denyOnce = () =>
    vi
      .mocked(requireFeature)
      .mockRejectedValueOnce(new EntitlementError("workflow_automation"));

  const post = () =>
    POST(
      createMockRequest("/api/admin/workflows", {
        method: "POST",
        body: {
          name: "Warranty alert",
          trigger: "warranty_expiring",
          conditions: {},
          actions: [],
          isActive: true,
        },
      }),
    );

  const put = (body: Record<string, unknown>) =>
    PUT(
      createMockRequest("/api/admin/workflows/rule-own", {
        method: "PUT",
        body,
      }),
      params("rule-own"),
    );

  it("POST requires the feature and creates nothing without it", async () => {
    denyOnce();

    const res = await post();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: "feature_not_entitled",
      feature: "workflow_automation",
    });
    expect(requireFeature).toHaveBeenCalledWith(admin, "workflow_automation");
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("POST creates the rule when the feature is granted", async () => {
    const res = await post();

    expect(res.status).toBe(201);
    expect(requireFeature).toHaveBeenCalledWith(admin, "workflow_automation");
  });

  it("PUT requires the feature for an edit", async () => {
    denyOnce();

    const res = await put({ name: "Renamed" });

    expect(res.status).toBe(403);
    expect(requireFeature).toHaveBeenCalledWith(admin, "workflow_automation");
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("PUT requires the feature to switch a rule on", async () => {
    denyOnce();

    const res = await put({ isActive: true });

    expect(res.status).toBe(403);
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("PUT gates a body that switches a rule off and edits it", async () => {
    denyOnce();

    const res = await put({ isActive: false, name: "Renamed" });

    expect(res.status).toBe(403);
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("PUT lets a rule be switched off without the feature", async () => {
    const res = await put({ isActive: false });

    expect(res.status).toBe(200);
    expect(requireFeature).not.toHaveBeenCalled();
    expect(mockPrisma.automationRule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rule-own" },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("keeps listing, reading and deleting open", async () => {
    expect((await GET()).status).toBe(200);
    expect(
      (
        await GET_BY_ID(
          createMockRequest("/api/admin/workflows/rule-own"),
          params("rule-own"),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await DELETE(
          createMockRequest("/api/admin/workflows/rule-own", {
            method: "DELETE",
          }),
          params("rule-own"),
        )
      ).status,
    ).toBe(200);

    expect(requireFeature).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 10: Write the failing engine tests**

In `src/lib/__tests__/workflow-engine.test.ts`, replace:

```ts
vi.mock("@/lib/org-suspension", () => ({ getOrgSuspensionStatus: vi.fn() }));
```

with:

```ts
vi.mock("@/lib/org-access", () => {
  const getOrgAccess = vi.fn();
  return {
    getOrgAccess,
    // Same contract as the real helper: one read per organization and cache.
    getCachedOrgAccess: (
      organizationId: string,
      cache: Map<string, Promise<unknown>>,
    ) => {
      const existing = cache.get(organizationId);
      if (existing) return existing;
      const pending = getOrgAccess(organizationId);
      cache.set(organizationId, pending);
      return pending;
    },
  };
});
```

and replace:

```ts
import { getOrgSuspensionStatus, type OrgStatus } from "@/lib/org-suspension";
import { triggerWebhook } from "@/lib/webhooks";
```

with:

```ts
import {
  getOrgAccess,
  type OrgAccess,
  type OrgAccessCache,
} from "@/lib/org-access";
import type { OrgStatus } from "@/lib/org-suspension";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";
import { triggerWebhook } from "@/lib/webhooks";
```

and replace:

```ts
const mockStatus = vi.mocked(getOrgSuspensionStatus);
```

with:

```ts
const mockAccess = vi.mocked(getOrgAccess);
```

and replace:

```ts
function givenRules(...rules: ReturnType<typeof rule>[]) {
  mockPrisma.automationRule.findMany.mockResolvedValue(rules as never);
}
```

with:

```ts
function givenRules(...rules: ReturnType<typeof rule>[]) {
  mockPrisma.automationRule.findMany.mockResolvedValue(rules as never);
}

function access(
  status: OrgStatus = "active",
  features: readonly GatedFeature[] = GATED_FEATURES,
): OrgAccess {
  return {
    status,
    entitlements: { features: [...features], maxAssets: null, maxUsers: null },
  };
}
```

and replace:

```ts
mockStatus.mockResolvedValue("active");
mockPrisma.automationRule.findMany.mockResolvedValue([]);
```

with:

```ts
mockAccess.mockResolvedValue(access());
mockPrisma.automationRule.findMany.mockResolvedValue([]);
```

and replace the three status tests:

```ts
it("runs no rules for a locked-out organization", async () => {
  mockStatus.mockResolvedValue("locked_out");
  givenRules(rule([{ type: "send_email", config: {} }]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(mockStatus).toHaveBeenCalledWith(ORG_A);
  expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  expect(mockQueueEmail).not.toHaveBeenCalled();
  expect(result).toEqual({ executed: 0, errors: [] });
});

it("still runs the rules of a read-only organization", async () => {
  mockStatus.mockResolvedValue("read_only");
  givenRules(rule([]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(result.executed).toBe(1);
});

it("looks the status up once per organization when a cache is shared", async () => {
  const cache = new Map<string, OrgStatus>();

  await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
  await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
  await processWorkflowTrigger("stock_low", {}, ORG_B, cache);

  expect(mockStatus).toHaveBeenCalledTimes(2);
  expect(mockStatus).toHaveBeenNthCalledWith(1, ORG_A);
  expect(mockStatus).toHaveBeenNthCalledWith(2, ORG_B);
});
```

with:

```ts
it("runs no rules for a locked-out organization", async () => {
  mockAccess.mockResolvedValue(access("locked_out"));
  givenRules(rule([{ type: "send_email", config: {} }]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(mockAccess).toHaveBeenCalledWith(ORG_A);
  expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  expect(mockQueueEmail).not.toHaveBeenCalled();
  expect(result).toEqual({ executed: 0, errors: [] });
});

it("still runs the rules of a read-only organization", async () => {
  mockAccess.mockResolvedValue(access("read_only"));
  givenRules(rule([]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(result.executed).toBe(1);
});

it("runs no rules for an organization without workflow automation", async () => {
  mockAccess.mockResolvedValue(access("active", ["api_keys"]));
  givenRules(rule([{ type: "send_email", config: {} }]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
  expect(mockQueueEmail).not.toHaveBeenCalled();
  expect(result).toEqual({ executed: 0, errors: [] });
});

it("runs the rules of an organization that has workflow automation", async () => {
  mockAccess.mockResolvedValue(access("active", ["workflow_automation"]));
  givenRules(rule([]));

  const result = await processWorkflowTrigger("warranty_expiring", {}, ORG_A);

  expect(result.executed).toBe(1);
});

it("reads the access once per organization when a cache is shared", async () => {
  const cache: OrgAccessCache = new Map();

  await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
  await processWorkflowTrigger("stock_low", {}, ORG_A, cache);
  await processWorkflowTrigger("stock_low", {}, ORG_B, cache);

  expect(mockAccess).toHaveBeenCalledTimes(2);
  expect(mockAccess).toHaveBeenNthCalledWith(1, ORG_A);
  expect(mockAccess).toHaveBeenNthCalledWith(2, ORG_B);
});
```

and replace:

```ts
  it("looks up each organization's status once per run", async () => {
```

with:

```ts
  it("reads each organization's access once per run", async () => {
```

and replace:

```ts
    expect(mockStatus).toHaveBeenCalledTimes(1);
    expect(mockStatus).toHaveBeenCalledWith(ORG_A);
  });

  it("runs nothing for a locked-out organization", async () => {
    mockStatus.mockResolvedValue("locked_out");
```

with:

```ts
    expect(mockAccess).toHaveBeenCalledTimes(1);
    expect(mockAccess).toHaveBeenCalledWith(ORG_A);
  });

  it("runs nothing for a locked-out organization", async () => {
    mockAccess.mockResolvedValue(access("locked_out"));
```

Append to `src/lib/__tests__/workflow-engine.test.ts`:

```ts
describe("runScheduledWorkflows entitlement", () => {
  it("runs nothing for an organization without workflow automation and reads its access once", async () => {
    mockAccess.mockResolvedValue(access("active", []));
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "a1",
        assetname: "A1",
        assettag: "T1",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
      {
        assetid: "a2",
        assetname: "A2",
        assettag: "T2",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
    ] as never);
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        consumableid: "c1",
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: ORG_A,
      },
    ] as never);

    const results = await runScheduledWorkflows();

    expect(mockPrisma.automationRule.findMany).not.toHaveBeenCalled();
    expect(mockAccess).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.executed === 0)).toBe(true);
  });

  it("only runs the organizations that have the feature", async () => {
    mockAccess.mockImplementation(async (organizationId) =>
      organizationId === ORG_A
        ? access("active", ["workflow_automation"])
        : access("active", []),
    );
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "a1",
        assetname: "A1",
        assettag: "T1",
        warrantyExpires: null,
        organizationId: ORG_A,
      },
      {
        assetid: "a2",
        assetname: "A2",
        assettag: "T2",
        warrantyExpires: null,
        organizationId: ORG_B,
      },
    ] as never);

    await runScheduledWorkflows();

    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith({
      where: {
        trigger: "warranty_expiring",
        isActive: true,
        organizationId: ORG_A,
      },
    });
  });
});
```

- [ ] **Step 11: Run the tests to verify they fail**

Run: `npx vitest run src/app/api/__tests__/workflows-scope.test.ts src/lib/__tests__/workflow-engine.test.ts`
Expected: FAIL. The workflow routes never call `requireFeature`, and the engine still reads `getOrgSuspensionStatus` (which the tests no longer mock), so every engine test that reaches an organization lookup fails.

- [ ] **Step 12: Gate the workflow routes**

In `src/app/api/admin/workflows/route.ts`, replace:

```ts
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireFeature,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

and replace:

```ts
    const user = await requireApiAdmin();
    await requireWritableOrg(user);

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create automation rules" },
```

with:

```ts
    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    await requireFeature(user, "workflow_automation");

    const orgId = user.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "An organization is required to create automation rules" },
```

In `src/app/api/admin/workflows/[id]/route.ts`, replace:

```ts
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

with:

```ts
import {
  requireApiAdmin,
  requireFeature,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
```

and replace:

```ts
function ruleNotFound() {
  return NextResponse.json(
    { error: "Automation rule not found" },
    { status: 404 },
  );
}
```

with:

```ts
function ruleNotFound() {
  return NextResponse.json(
    { error: "Automation rule not found" },
    { status: 404 },
  );
}

/**
 * A body that only switches a rule off is not configuration, so it stays
 * possible after the feature was revoked. Anything else counts as an edit.
 */
function isDeactivationOnly(update: Record<string, unknown>): boolean {
  const changed = Object.keys(update).filter(
    (key) => update[key] !== undefined,
  );
  return changed.length === 1 && update.isActive === false;
}
```

and replace:

```ts
const validated = validateBody(updateAutomationRuleSchema, body);
if (validated instanceof NextResponse) return validated;
const { name, description, trigger, conditions, actions, isActive } = validated;
```

with:

```ts
const validated = validateBody(updateAutomationRuleSchema, body);
if (validated instanceof NextResponse) return validated;

if (!isDeactivationOnly(validated)) {
  await requireFeature(user, "workflow_automation");
}

const { name, description, trigger, conditions, actions, isActive } = validated;
```

- [ ] **Step 13: Skip organizations without the feature in the engine**

In `src/lib/workflow-engine.ts`, replace:

```ts
import { getOrgSuspensionStatus, type OrgStatus } from "@/lib/org-suspension";
```

with:

```ts
import { allowsFeature } from "@/lib/entitlements-shared";
import { getCachedOrgAccess, type OrgAccessCache } from "@/lib/org-access";
```

and replace:

```ts
const recipientSchema = z.string().email();

/** Org status lookups memoised for the duration of one run. */
type OrgStatusCache = Map<string, OrgStatus>;

/**
 * Build the error
```

with:

```ts
const recipientSchema = z.string().email();

/**
 * Build the error
```

and replace:

```ts
async function getCachedOrgStatus(
  organizationId: string,
  cache: OrgStatusCache,
): Promise<OrgStatus> {
  const cached = cache.get(organizationId);
  if (cached) return cached;
  const status = await getOrgSuspensionStatus(organizationId);
  cache.set(organizationId, status);
  return status;
}

/**
 * Process a single workflow trigger with context data.
 * Finds the organization's active automation rules matching the trigger,
 * evaluates conditions, and executes actions for matching rules.
 *
 * Locked-out organizations run no rules. Pass a shared `orgStatusCache` when
 * calling repeatedly within one run to look each organization up only once.
 */
export async function processWorkflowTrigger(
  trigger: WorkflowTrigger,
  data: Record<string, unknown>,
  organizationId: string,
  orgStatusCache: OrgStatusCache = new Map(),
): Promise<{ executed: number; errors: string[] }> {
  // Prisma drops an undefined filter, which would load every organization's rules.
  if (!organizationId) {
    const msg = "Workflow trigger requires an organization";
    logger.error("Workflow execution error", { error: msg, trigger });
    return { executed: 0, errors: [msg] };
  }

  if (
    (await getCachedOrgStatus(organizationId, orgStatusCache)) === "locked_out"
  ) {
    return { executed: 0, errors: [] };
  }
```

with:

```ts
/**
 * Process a single workflow trigger with context data.
 * Finds the organization's active automation rules matching the trigger,
 * evaluates conditions, and executes actions for matching rules.
 *
 * Locked-out organizations and organizations without the workflow_automation
 * entitlement run no rules; both skips are silent because the engine runs once
 * per matching record. Pass a shared `accessCache` when calling repeatedly
 * within one run to read each organization's access only once.
 */
export async function processWorkflowTrigger(
  trigger: WorkflowTrigger,
  data: Record<string, unknown>,
  organizationId: string,
  accessCache: OrgAccessCache = new Map(),
): Promise<{ executed: number; errors: string[] }> {
  // Prisma drops an undefined filter, which would load every organization's rules.
  if (!organizationId) {
    const msg = "Workflow trigger requires an organization";
    logger.error("Workflow execution error", { error: msg, trigger });
    return { executed: 0, errors: [msg] };
  }

  const access = await getCachedOrgAccess(organizationId, accessCache);
  if (
    access.status === "locked_out" ||
    !allowsFeature(access.entitlements, "workflow_automation")
  ) {
    return { executed: 0, errors: [] };
  }
```

and replace:

```ts
const orgStatusCache: OrgStatusCache = new Map();
let skippedWithoutOrganization = 0;
```

with:

```ts
const accessCache: OrgAccessCache = new Map();
let skippedWithoutOrganization = 0;
```

and replace:

```ts
      organizationId,
      orgStatusCache,
    );
    results.push({ trigger, ...r });
```

with:

```ts
      organizationId,
      accessCache,
    );
    results.push({ trigger, ...r });
```

- [ ] **Step 14: Run the tests, the type check, the linter and the whole suite**

Run: `npx vitest run src/app/api/__tests__/workflows-scope.test.ts src/lib/__tests__/workflow-engine.test.ts src/app/api/__tests__/route-conventions.test.ts`
Expected: PASS.

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/app/api/admin/workflows/route.ts "src/app/api/admin/workflows/[id]/route.ts" src/lib/workflow-engine.ts src/app/api/__tests__/workflows-scope.test.ts src/lib/__tests__/workflow-engine.test.ts`
Expected: no errors.

Run: `npx vitest run`
Expected: PASS (DB tests skipped locally).

- [ ] **Step 15: Commit**

```bash
git add src/app/api/admin/workflows/route.ts "src/app/api/admin/workflows/[id]/route.ts" src/lib/workflow-engine.ts src/app/api/__tests__/workflows-scope.test.ts src/lib/__tests__/workflow-engine.test.ts
git commit -m "feat: gate workflow rules and the workflow engine by entitlement"
```

#### Part C: the enforcement matrix over the real guards

The unit tests above mock `requireFeature`. This test mocks only the edges (BetterAuth, Prisma, RBAC) and runs the real guards and the real entitlement resolution, so each case follows the whole chain from the stored value on the organization row to the route's answer. It covers the gated routes of Tasks 7 and 8 in the three situations the spec's enforcement matrix names: cloud mode denied, cloud mode allowed, and a deployment without a control plane, where stale restrictive stored entitlements must never restrict anything (Review Focus 1).

- [ ] **Step 16: Write the matrix test**

Create `src/app/api/__tests__/entitlement-gates-matrix.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";
import { stubCloudMode } from "../../../../tests/setup/cloud-mode";

// Only the edges are mocked (BetterAuth, Prisma, RBAC). The guards and the
// entitlement resolution run for real, so each case follows the whole chain:
// stored value -> resolution -> user -> route gate.
vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/rbac", () => ({
  hasPermission: vi.fn(),
  hasAnyPermission: vi.fn(),
}));
vi.mock("@/lib/super-admin", () => ({ isSuperAdmin: vi.fn() }));
vi.mock("@/lib/api-keys", () => ({ validateApiKey: vi.fn() }));
vi.mock("@/lib/cache", () => ({
  cached: vi.fn(async (_key: string, fetcher: () => Promise<unknown>) =>
    fetcher(),
  ),
}));
vi.mock("@/lib/scheduled-reports", () => ({
  computeNextRunAt: vi.fn(() => new Date("2026-10-19T00:00:00.000Z")),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  verifyEntityOrgOwnership: vi.fn(),
  scopeToOrganization: (where: object, organizationId?: string | null) => ({
    ...where,
    organizationId: organizationId ?? null,
  }),
}));

import { GET as advancedReports } from "@/app/api/reports/advanced/route";
import { GET as tcoDashboard } from "@/app/api/dashboard/tco/route";
import { POST as createDefinition } from "@/app/api/admin/custom-fields/route";
import { POST as saveValues } from "@/app/api/custom-fields/values/route";
import { POST as createRule } from "@/app/api/admin/workflows/route";
import { POST as subscribeReport } from "@/app/api/report-schedules/route";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  getOrganizationContext,
  verifyEntityOrgOwnership,
} from "@/lib/organization-context";
import { GATED_FEATURES, type GatedFeature } from "@/lib/entitlements-shared";

const mockPrisma = vi.mocked(prisma, true);
const mockAuth = vi.mocked(auth, true);

const ENTITY_ID = "44444444-4444-4444-8444-444444444444";

const post = (url: string, body: Record<string, unknown>) =>
  createMockRequest(url, { method: "POST", body });

/** The calling admin, whose organization row holds `stored` entitlements. */
function signIn(stored: unknown) {
  mockAuth.api.getSession.mockResolvedValue({
    user: { id: "admin-1" },
  } as never);
  mockPrisma.user.findUnique.mockResolvedValue({
    userid: "admin-1",
    username: "ada",
    firstname: "Ada",
    lastname: "Admin",
    email: "ada@example.com",
    isadmin: true,
    canrequest: true,
    organizationId: "org-1",
    departmentId: null,
    isActive: true,
    organization: {
      isActive: true,
      suspendedAt: null,
      lockedAt: null,
      entitlements: stored,
    },
  } as never);
}

const withoutFeature = (feature: GatedFeature) => ({
  features: GATED_FEATURES.filter((candidate) => candidate !== feature),
  maxAssets: null,
  maxUsers: null,
});

const onlyFeature = (feature: GatedFeature) => ({
  features: [feature],
  maxAssets: null,
  maxUsers: null,
});

interface Probe {
  name: string;
  feature: GatedFeature;
  call: () => Promise<Response>;
}

const probes: Probe[] = [
  {
    name: "GET /api/reports/advanced",
    feature: "advanced_reports",
    call: () => advancedReports(),
  },
  {
    name: "GET /api/dashboard/tco",
    feature: "tco_dashboard",
    call: () => tcoDashboard(),
  },
  {
    name: "POST /api/admin/custom-fields",
    feature: "custom_fields",
    call: () =>
      createDefinition(
        post("/api/admin/custom-fields", {
          name: "Cost centre",
          fieldType: "text",
          entityType: "asset",
          isRequired: false,
          displayOrder: 0,
        }),
      ),
  },
  {
    name: "POST /api/custom-fields/values",
    feature: "custom_fields",
    call: () =>
      saveValues(
        post("/api/custom-fields/values", {
          entityId: ENTITY_ID,
          entityType: "asset",
          values: {},
        }),
      ),
  },
  {
    name: "POST /api/admin/workflows",
    feature: "workflow_automation",
    call: () =>
      createRule(
        post("/api/admin/workflows", {
          name: "Warranty alert",
          trigger: "warranty_expiring",
          conditions: {},
          actions: [],
          isActive: true,
        }),
      ),
  },
  {
    name: "POST /api/report-schedules (TCO report)",
    feature: "tco_dashboard",
    call: () =>
      subscribeReport(
        post("/api/report-schedules", {
          reportType: "tco",
          frequency: "weekly",
          format: "csv",
        }),
      ),
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOrganizationContext).mockResolvedValue({
    userId: "admin-1",
    organization: { id: "org-1" },
  } as never);
  vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(true);
  mockPrisma.licence.aggregate.mockResolvedValue({
    _sum: { purchaseprice: null },
  } as never);
  mockPrisma.reportSchedule.findFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe.each(probes)("$name", ({ feature, call }) => {
  it("denies an organization whose stored entitlements lack the feature", async () => {
    stubCloudMode();
    signIn(withoutFeature(feature));

    const res = await call();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      code: "feature_not_entitled",
      feature,
    });
  });

  it("denies an organization with nothing stored: the new-organization entitlements apply", async () => {
    stubCloudMode();
    signIn(null);

    const res = await call();

    expect(res.status).toBe(403);
  });

  it("allows an organization that has the feature", async () => {
    stubCloudMode();
    signIn(onlyFeature(feature));

    const res = await call();

    expect(res.status).toBeLessThan(300);
  });

  it("allows everything outside cloud mode, whatever is stored", async () => {
    signIn({ features: [], maxAssets: 0, maxUsers: 0 });

    const res = await call();

    expect(res.status).toBeLessThan(300);
  });
});
```

- [ ] **Step 17: Run it and prove it can fail**

Run: `npx vitest run src/app/api/__tests__/entitlement-gates-matrix.test.ts`
Expected: PASS (24 tests). There is no red phase here: the gates already exist after Task 7 and Parts A and B, and this test is the regression net around them.

To see it catch a regression once, delete the line `await requireFeature(user, "tco_dashboard");` from `src/app/api/dashboard/tco/route.ts`, run the command again, and expect the two denial cases of `GET /api/dashboard/tco` to fail. Then restore the file with `git checkout -- src/app/api/dashboard/tco/route.ts`.

- [ ] **Step 18: Run the type check and the linter, then commit**

Run: `npx tsc --noEmit -p .`
Expected: no errors.

Run: `npx eslint src/app/api/__tests__/entitlement-gates-matrix.test.ts`
Expected: no errors.

```bash
git add src/app/api/__tests__/entitlement-gates-matrix.test.ts
git commit -m "test: pin the entitlement gates of the gated routes in cloud and self-hosted mode"
```
