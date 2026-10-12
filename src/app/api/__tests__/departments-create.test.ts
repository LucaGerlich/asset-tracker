import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { CREATE: "CREATE" },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue(null),
  scopeToOrganization: vi.fn(),
}));

import { POST } from "@/app/api/departments/route";
import prisma from "@/lib/prisma";
import { requirePermission, requireWritableOrg } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const OWN_ORG = "11111111-1111-4111-8111-111111111111";
const FOREIGN_ORG = "22222222-2222-4222-8222-222222222222";
const OWN_PARENT = "33333333-3333-4333-8333-333333333333";
const FOREIGN_PARENT = "44444444-4444-4444-8444-444444444444";

const manager = {
  id: "manager-uuid-001",
  isAdmin: true,
  organizationId: OWN_ORG,
  orgStatus: "active" as const,
};

const create = (body: Record<string, unknown>) =>
  POST(createMockRequest("/api/departments", { method: "POST", body }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requirePermission).mockResolvedValue(manager as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
  mockPrisma.department.create.mockResolvedValue({
    id: "dept-new",
    name: "IT",
    organizationId: OWN_ORG,
  } as never);

  // In-memory stand-in with Prisma semantics: a department is only found in
  // the org it belongs to.
  mockPrisma.department.findFirst.mockImplementation((async ({
    where,
  }: {
    where: { id: string; organizationId?: string };
  }) =>
    where.id === OWN_PARENT && where.organizationId === OWN_ORG
      ? { id: OWN_PARENT }
      : null) as never);
});

describe("POST /api/departments", () => {
  it("creates the department in the caller's org", async () => {
    const res = await create({ name: "IT", organizationId: OWN_ORG });

    expect(res.status).toBe(201);
    expect(mockPrisma.department.create.mock.calls[0][0].data).toMatchObject({
      name: "IT",
      organizationId: OWN_ORG,
    });
  });

  it("does not need an organizationId in the body", async () => {
    const res = await create({ name: "IT" });

    expect(res.status).toBe(201);
    expect(mockPrisma.department.create.mock.calls[0][0].data).toMatchObject({
      organizationId: OWN_ORG,
    });
  });

  it("answers 403 and creates nothing for another org named in the body", async () => {
    const res = await create({ name: "IT", organizationId: FOREIGN_ORG });

    expect(res.status).toBe(403);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
  });

  it("answers 403 and creates nothing when the caller has no organization", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...manager,
      organizationId: undefined,
    } as never);

    const res = await create({ name: "IT", organizationId: FOREIGN_ORG });

    expect(res.status).toBe(403);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("answers 403 for a caller without an organization even without a body organizationId", async () => {
    vi.mocked(requirePermission).mockResolvedValue({
      ...manager,
      organizationId: undefined,
    } as never);

    const res = await create({ name: "IT" });

    expect(res.status).toBe(403);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
  });

  it("accepts a parent department of the caller's org", async () => {
    const res = await create({ name: "IT", parentId: OWN_PARENT });

    expect(res.status).toBe(201);
    expect(mockPrisma.department.create.mock.calls[0][0].data).toMatchObject({
      parentId: OWN_PARENT,
    });
  });

  it("answers 404 and creates nothing for a parent department of another org", async () => {
    const res = await create({ name: "IT", parentId: FOREIGN_PARENT });

    expect(res.status).toBe(404);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
  });

  it("returns 403 and creates nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await create({ name: "IT" });

    expect(res.status).toBe(403);
    expect(mockPrisma.department.create).not.toHaveBeenCalled();
  });
});
