import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  verifyEntityOrgOwnership: vi.fn(),
  scopeToOrganization: <T extends Record<string, unknown>>(
    where: T,
    organizationId?: string | null,
  ) => ({ ...where, organizationId: organizationId ?? null }),
}));

import { GET, POST } from "@/app/api/admin/custom-fields/route";
import { PUT, PATCH, DELETE } from "@/app/api/admin/custom-fields/[id]/route";
import {
  GET as GET_VALUES,
  POST as POST_VALUES,
} from "@/app/api/custom-fields/values/route";
import { GET as SEARCH } from "@/app/api/search/advanced/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireApiAuth,
  requireWritableOrg,
} from "@/lib/api-auth";
import {
  getOrganizationContext,
  verifyEntityOrgOwnership,
} from "@/lib/organization-context";
import { createCustomFieldDefinitionSchema } from "@/lib/validation";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "org-uuid-001";
const OTHER_ORG = "org-uuid-002";

const OWN_FIELD = "11111111-1111-4111-8111-111111111111";
const OWN_FIELD_2 = "33333333-3333-4333-8333-333333333333";
const FOREIGN_FIELD = "22222222-2222-4222-8222-222222222222";
const ENTITY_ID = "44444444-4444-4444-8444-444444444444";

const caller = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

interface Definition {
  id: string;
  name: string;
  fieldType: string;
  entityType: string;
  isActive: boolean;
  displayOrder: number;
  options: string | null;
  isRequired: boolean;
  organizationId: string;
}

const definitions: Definition[] = [
  {
    id: OWN_FIELD,
    name: "Cost centre",
    fieldType: "text",
    entityType: "asset",
    isActive: true,
    displayOrder: 0,
    options: null,
    isRequired: false,
    organizationId: OWN_ORG,
  },
  {
    id: OWN_FIELD_2,
    name: "Colour",
    fieldType: "text",
    entityType: "asset",
    isActive: true,
    displayOrder: 1,
    options: null,
    isRequired: false,
    organizationId: OWN_ORG,
  },
  {
    id: FOREIGN_FIELD,
    name: "Foreign field",
    fieldType: "text",
    entityType: "asset",
    isActive: true,
    displayOrder: 0,
    options: null,
    isRequired: false,
    organizationId: OTHER_ORG,
  },
];

interface DefinitionWhere {
  id?: string | { in: string[] };
  organizationId?: string | null;
  entityType?: string;
  isActive?: boolean;
}

/**
 * In-memory stand-in with Prisma semantics: an `undefined` filter value
 * matches every row, so a missing organization can never narrow the query.
 */
function matches(def: Definition, where: DefinitionWhere): boolean {
  const idMatches =
    where.id === undefined ||
    (typeof where.id === "string"
      ? def.id === where.id
      : where.id.in.includes(def.id));
  return (
    idMatches &&
    (where.organizationId === undefined ||
      def.organizationId === where.organizationId) &&
    (where.entityType === undefined || def.entityType === where.entityType) &&
    (where.isActive === undefined || def.isActive === where.isActive)
  );
}

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const orgless = () => {
  vi.mocked(requireApiAdmin).mockResolvedValue({
    ...caller,
    organizationId: undefined,
  } as never);
  vi.mocked(requireApiAuth).mockResolvedValue({
    ...caller,
    organizationId: undefined,
  } as never);
  vi.mocked(getOrganizationContext).mockResolvedValue({
    organization: null,
  } as never);
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAdmin).mockResolvedValue(caller as never);
  vi.mocked(requireApiAuth).mockResolvedValue(caller as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
  vi.mocked(getOrganizationContext).mockResolvedValue({
    organization: { id: OWN_ORG },
  } as never);
  vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(true);

  mockPrisma.custom_field_definitions.findMany.mockImplementation((async ({
    where,
  }: {
    where?: DefinitionWhere;
  }) => definitions.filter((d) => matches(d, where ?? {}))) as never);
  mockPrisma.custom_field_definitions.findFirst.mockImplementation(
    (async ({ where }: { where: DefinitionWhere }) =>
      definitions.find((d) => matches(d, where)) ?? null) as never,
  );
  mockPrisma.custom_field_definitions.create.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ id: "def-new", ...data })) as never);
  mockPrisma.custom_field_definitions.update.mockImplementation((async ({
    data,
  }: {
    data: Record<string, unknown>;
  }) => ({ ...definitions[0], ...data })) as never);
});

describe("GET /api/admin/custom-fields", () => {
  it("lists only the definitions of the caller's organization", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: OWN_ORG }),
      }),
    );
    const body = (await res.json()) as Array<{ id: string }>;
    expect(body.map((d) => d.id)).toEqual([OWN_FIELD, OWN_FIELD_2]);
  });

  it("returns an empty list without querying when the caller has no organization", async () => {
    orgless();

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/admin/custom-fields", () => {
  // The shape CustomFieldsAdminTab sends: options is an array for selects and
  // undefined for every other field type.
  const uiBody = {
    name: "  Cost centre  ",
    fieldType: "select",
    entityType: "asset",
    isRequired: true,
    displayOrder: 3,
    options: ["A", "B"],
  };

  const post = (body: Record<string, unknown>) =>
    POST(
      createMockRequest("/api/admin/custom-fields", {
        method: "POST",
        body,
      }),
    );

  it("stores the caller's organization on the new definition", async () => {
    const res = await post(uiBody);

    expect(res.status).toBe(201);
    expect(mockPrisma.custom_field_definitions.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: OWN_ORG,
        name: "Cost centre",
        fieldType: "select",
        entityType: "asset",
        isRequired: true,
        displayOrder: 3,
        options: JSON.stringify(["A", "B"]),
      }),
    });
  });

  it("ignores an organizationId supplied in the body", async () => {
    await post({ ...uiBody, organizationId: OTHER_ORG });

    expect(mockPrisma.custom_field_definitions.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ organizationId: OWN_ORG }),
    });
  });

  it("rejects an entity type outside the entity registry with 400", async () => {
    const res = await post({ ...uiBody, entityType: "user" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_definitions.create).not.toHaveBeenCalled();
  });

  it("rejects a field type the admin UI does not offer with 400", async () => {
    const res = await post({ ...uiBody, fieldType: "script" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_definitions.create).not.toHaveBeenCalled();
  });

  it("rejects the request when the caller has no organization", async () => {
    orgless();

    const res = await post(uiBody);

    expect(res.status).toBe(403);
    expect(mockPrisma.custom_field_definitions.create).not.toHaveBeenCalled();
  });
});

describe("PUT/PATCH/DELETE /api/admin/custom-fields/[id]", () => {
  const send = (
    handler: typeof PUT | typeof PATCH,
    method: "PUT" | "PATCH",
    id: string,
    body: Record<string, unknown>,
  ) =>
    handler(
      createMockRequest(`/api/admin/custom-fields/${id}`, { method, body }),
      params(id),
    );

  const del = (id: string) =>
    DELETE(
      createMockRequest(`/api/admin/custom-fields/${id}`, {
        method: "DELETE",
      }),
      params(id),
    );

  it("updates a definition of the caller's organization after the scoped lookup", async () => {
    const res = await send(PUT, "PUT", OWN_FIELD, { name: "Renamed" });

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OWN_FIELD, organizationId: OWN_ORG },
      }),
    );
    expect(mockPrisma.custom_field_definitions.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: OWN_FIELD } }),
    );
  });

  it("answers 404 and does not update a definition of another organization", async () => {
    const res = await send(PUT, "PUT", FOREIGN_FIELD, { name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
  });

  it("does not let the body move a definition to another organization", async () => {
    await send(PUT, "PUT", OWN_FIELD, {
      name: "Renamed",
      organizationId: OTHER_ORG,
    });

    const call = mockPrisma.custom_field_definitions.update.mock
      .calls[0]?.[0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty("organizationId");
  });

  it("rejects an invalid entity type on update with 400", async () => {
    const res = await send(PUT, "PUT", OWN_FIELD, { entityType: "user" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
  });

  it("answers 404 and does not toggle a definition of another organization", async () => {
    const res = await send(PATCH, "PATCH", FOREIGN_FIELD, {
      isActive: false,
    });

    expect(res.status).toBe(404);
    expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
  });

  it("toggles a definition of the caller's organization", async () => {
    const res = await send(PATCH, "PATCH", OWN_FIELD, { isActive: false });

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: OWN_FIELD },
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("deletes a definition of the caller's organization", async () => {
    const res = await del(OWN_FIELD);

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.delete).toHaveBeenCalledWith({
      where: { id: OWN_FIELD },
    });
  });

  it("answers 404 and does not delete a definition of another organization", async () => {
    const res = await del(FOREIGN_FIELD);

    expect(res.status).toBe(404);
    expect(mockPrisma.custom_field_definitions.delete).not.toHaveBeenCalled();
  });

  it("answers 404 without querying when the caller has no organization", async () => {
    orgless();

    const results = await Promise.all([
      send(PUT, "PUT", OWN_FIELD, { name: "x" }),
      send(PATCH, "PATCH", OWN_FIELD, { isActive: false }),
      del(OWN_FIELD),
    ]);

    expect(results.map((r) => r.status)).toEqual([404, 404, 404]);
    expect(
      mockPrisma.custom_field_definitions.findFirst,
    ).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_definitions.update).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_definitions.delete).not.toHaveBeenCalled();
  });
});

describe("GET /api/custom-fields/values", () => {
  const get = () =>
    GET_VALUES(
      createMockRequest(
        `/api/custom-fields/values?entityType=asset&entityId=${ENTITY_ID}`,
      ),
    );

  it("loads only the active definitions of the caller's organization", async () => {
    mockPrisma.custom_field_values.findMany.mockResolvedValue([
      { fieldId: OWN_FIELD, value: "CC-1" },
    ] as never);

    const res = await get();

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: "asset",
          isActive: true,
          organizationId: OWN_ORG,
        },
      }),
    );
    const body = (await res.json()) as Array<{
      id: string;
      value: string | null;
    }>;
    expect(body.map((d) => d.id)).toEqual([OWN_FIELD, OWN_FIELD_2]);
    expect(body[0]?.value).toBe("CC-1");
  });

  it("returns an empty list without querying when the caller has no organization", async () => {
    orgless();

    const res = await get();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_values.findMany).not.toHaveBeenCalled();
  });

  it("answers 404 when the entity belongs to another organization", async () => {
    vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(false);

    const res = await get();

    expect(res.status).toBe(404);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
  });
});

describe("POST /api/custom-fields/values", () => {
  const post = (values: unknown) =>
    POST_VALUES(
      createMockRequest("/api/custom-fields/values", {
        method: "POST",
        body: { entityId: ENTITY_ID, entityType: "asset", values } as Record<
          string,
          unknown
        >,
      }),
    );

  it("upserts values for fields of the caller's organization", async () => {
    const res = await post({ [OWN_FIELD]: "CC-1", [OWN_FIELD_2]: null });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, count: 2 });
    expect(mockPrisma.custom_field_definitions.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [OWN_FIELD, OWN_FIELD_2] },
        organizationId: OWN_ORG,
        entityType: "asset",
        isActive: true,
      },
      select: { id: true },
    });
    expect(mockPrisma.custom_field_values.upsert).toHaveBeenCalledTimes(2);
    expect(mockPrisma.custom_field_values.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          fieldId_entityId: { fieldId: OWN_FIELD, entityId: ENTITY_ID },
        },
      }),
    );
  });

  it("answers 400 and writes nothing for a field of another organization", async () => {
    const res = await post({ [FOREIGN_FIELD]: "stolen" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "Unknown custom fields",
      fieldIds: [FOREIGN_FIELD],
    });
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });

  it("writes nothing at all when only one of the fields is foreign", async () => {
    const res = await post({ [OWN_FIELD]: "ok", [FOREIGN_FIELD]: "stolen" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });

  it("answers 400 for a field that belongs to another entity type", async () => {
    mockPrisma.custom_field_definitions.findMany.mockImplementation((async ({
      where,
    }: {
      where: DefinitionWhere;
    }) =>
      definitions
        .map((d) => ({ ...d, entityType: "licence" }))
        .filter((d) => matches(d, where))) as never);

    const res = await post({ [OWN_FIELD]: "wrong type" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });

  it("answers 400 for a field id that is not a UUID without querying it", async () => {
    const res = await post({ "not-a-uuid": "x" });

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
  });

  it("answers 400 when values is not an object", async () => {
    const res = await post([OWN_FIELD]);

    expect(res.status).toBe(400);
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });

  it("answers 404 when the entity belongs to another organization", async () => {
    vi.mocked(verifyEntityOrgOwnership).mockResolvedValue(false);

    const res = await post({ [OWN_FIELD]: "x" });

    expect(res.status).toBe(404);
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });

  it("rejects the request when the caller has no organization", async () => {
    orgless();

    const res = await post({ [OWN_FIELD]: "x" });

    expect(res.status).toBe(403);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_values.upsert).not.toHaveBeenCalled();
  });
});

describe("GET /api/search/advanced with custom field filters", () => {
  const search = (filters: unknown[]) =>
    SEARCH(
      createMockRequest(
        `/api/search/advanced?entity=asset&filters=${encodeURIComponent(
          JSON.stringify(filters),
        )}`,
      ) as never,
    );

  const customFilter = (field: unknown, value = "x") => ({
    field,
    op: "eq",
    value,
    isCustom: true,
  });

  it("looks up values only for fields of the caller's organization", async () => {
    mockPrisma.custom_field_values.findMany.mockResolvedValue([
      { entityId: "asset-1" },
    ] as never);

    const res = await search([customFilter(OWN_FIELD, "CC-1")]);

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: [OWN_FIELD] },
          organizationId: OWN_ORG,
        }),
      }),
    );
    expect(mockPrisma.custom_field_values.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fieldId: OWN_FIELD }),
      }),
    );
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assetid: { in: ["asset-1"] } }),
      }),
    );
  });

  it("never reads values of another organization's field and matches nothing", async () => {
    const res = await search([customFilter(FOREIGN_FIELD)]);

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_values.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assetid: { in: [] } }),
      }),
    );
  });

  it("matches nothing when one of several filters uses a foreign field", async () => {
    mockPrisma.custom_field_values.findMany.mockResolvedValue([
      { entityId: "asset-1" },
    ] as never);

    await search([customFilter(OWN_FIELD), customFilter(FOREIGN_FIELD)]);

    expect(mockPrisma.custom_field_values.findMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fieldId: FOREIGN_FIELD }),
      }),
    );
    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assetid: { in: [] } }),
      }),
    );
  });

  it("matches nothing for a field id that is not a UUID", async () => {
    const res = await search([customFilter("not-a-uuid"), customFilter(42)]);

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_values.findMany).not.toHaveBeenCalled();
  });

  it("matches nothing when the caller has no organization", async () => {
    orgless();

    const res = await search([customFilter(OWN_FIELD)]);

    expect(res.status).toBe(200);
    expect(mockPrisma.custom_field_definitions.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.custom_field_values.findMany).not.toHaveBeenCalled();
  });
});

describe("createCustomFieldDefinitionSchema", () => {
  const valid = { name: "Field", fieldType: "text", entityType: "asset" };

  it.each(["text", "number", "date", "checkbox", "select", "textarea"])(
    "accepts the %s field type",
    (fieldType) => {
      expect(
        createCustomFieldDefinitionSchema.safeParse({ ...valid, fieldType })
          .success,
      ).toBe(true);
    },
  );

  it.each(["asset", "accessory", "consumable", "licence", "component", "kit"])(
    "accepts the %s entity type",
    (entityType) => {
      expect(
        createCustomFieldDefinitionSchema.safeParse({ ...valid, entityType })
          .success,
      ).toBe(true);
    },
  );

  it("rejects unknown field and entity types and blank names", () => {
    for (const bad of [
      { fieldType: "script" },
      { entityType: "user" },
      { entityType: "" },
      { name: "   " },
      { name: "x".repeat(101) },
    ]) {
      expect(
        createCustomFieldDefinitionSchema.safeParse({ ...valid, ...bad })
          .success,
      ).toBe(false);
    }
  });
});
