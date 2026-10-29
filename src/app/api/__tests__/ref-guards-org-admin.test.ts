import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * User and purchase-request writes store department and supplier ids from
 * the request body. Each must belong to the caller's organization, or a
 * tenant could file its users or requests under another tenant's department
 * and have a foreign supplier copied onto its purchase orders.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/rbac", () => ({ hasPermission: vi.fn() }));
vi.mock("@/lib/auth-utils", () => ({ setUserPassword: vi.fn() }));

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId || null,
    }),
  ),
}));

vi.mock("@/lib/audit-log", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/audit-log")>()),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

import { PUT as updateUser } from "@/app/api/user/route";
import { POST as createRequest } from "@/app/api/procurement/requests/route";
import { PUT as updateRequest } from "@/app/api/procurement/requests/[id]/route";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockOrgContext = vi.mocked(getOrganizationContext);

const CALLER_ORG = "org-uuid-001";
const RECORD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DEPARTMENT_ID = "11111111-1111-4111-8111-111111111111";
const SUPPLIER_ID = "22222222-2222-4222-8222-222222222222";

type MockFn = ReturnType<typeof vi.fn>;

// findMany echoes the requested ids, i.e. every id is in the organization.
function echoIds(model: "department" | "supplier") {
  (mockPrisma[model].findMany as unknown as MockFn).mockImplementation(
    async (args: {
      where: Record<string, { in: string[] }>;
      select: Record<string, true>;
    }) => {
      const [idField] = Object.keys(args.select);
      return args.where[idField].in.map((id) => ({ [idField]: id }));
    },
  );
}

const request = (method: string, body: Record<string, unknown>) =>
  createMockRequest("/api/test", { method, body });

const requestContext = { params: Promise.resolve({ id: RECORD_ID }) };

const procurementBody = {
  title: "Laptops",
  departmentId: DEPARTMENT_ID,
  items: [{ description: "Laptop", supplierId: SUPPLIER_ID }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockOrgContext.mockResolvedValue({
    organization: { id: CALLER_ORG },
    userId: "admin-uuid-001",
  } as Awaited<ReturnType<typeof getOrganizationContext>>);
  echoIds("department");
  echoIds("supplier");
  mockPrisma.user.findFirst.mockResolvedValue({
    change_date: null,
  } as never);
  mockPrisma.user.update.mockResolvedValue({ userid: RECORD_ID } as never);
  mockPrisma.user.updateMany.mockResolvedValue({ count: 1 });
  mockPrisma.purchaseRequest.create.mockResolvedValue({
    id: RECORD_ID,
    title: "Laptops",
  } as never);
  mockPrisma.purchaseRequest.findFirst.mockResolvedValue({
    id: RECORD_ID,
    status: "draft",
    requesterId: "admin-uuid-001",
    items: [],
  } as never);
  mockPrisma.purchaseRequest.update.mockResolvedValue({
    id: RECORD_ID,
    title: "Laptops",
  } as never);
});

describe("PUT /api/user", () => {
  const body = { userid: RECORD_ID, departmentId: DEPARTMENT_ID };

  it("rejects a department from another organization", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);

    const { status, body: res } = await parseResponse<{ error: string }>(
      await updateUser(request("PUT", body)),
    );

    expect(status).toBe(400);
    expect(res.error).toBe("Department not found in your organization");
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.user.updateMany).not.toHaveBeenCalled();
  });

  it("checks the department inside the caller's organization, then updates", async () => {
    const res = await updateUser(request("PUT", body));

    expect(res.status).toBe(200);
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [DEPARTMENT_ID] }, organizationId: CALLER_ORG },
      }),
    );
  });
});

describe("POST /api/procurement/requests", () => {
  it("rejects a department from another organization", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await createRequest(request("POST", procurementBody)),
    );

    expect(status).toBe(400);
    expect(mockPrisma.purchaseRequest.create).not.toHaveBeenCalled();
  });

  it("rejects an item supplier from another organization", async () => {
    mockPrisma.supplier.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await createRequest(request("POST", procurementBody)),
    );

    expect(status).toBe(400);
    expect(mockPrisma.purchaseRequest.create).not.toHaveBeenCalled();
  });

  it("checks department and suppliers inside the caller's organization", async () => {
    const res = await createRequest(request("POST", procurementBody));

    expect(res.status).toBe(201);
    expect(mockPrisma.supplier.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          supplierid: { in: [SUPPLIER_ID] },
          organizationId: CALLER_ORG,
        },
      }),
    );
    expect(mockPrisma.purchaseRequest.create).toHaveBeenCalled();
  });
});

describe("PUT /api/procurement/requests/[id]", () => {
  it("rejects a department from another organization", async () => {
    mockPrisma.department.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await updateRequest(request("PUT", procurementBody), requestContext),
    );

    expect(status).toBe(400);
    expect(mockPrisma.purchaseRequest.update).not.toHaveBeenCalled();
    expect(mockPrisma.purchaseRequestItem.createMany).not.toHaveBeenCalled();
  });

  it("rejects an item supplier from another organization", async () => {
    mockPrisma.supplier.findMany.mockResolvedValue([]);

    const { status } = await parseResponse(
      await updateRequest(request("PUT", procurementBody), requestContext),
    );

    expect(status).toBe(400);
    expect(mockPrisma.purchaseRequestItem.createMany).not.toHaveBeenCalled();
  });

  it("checks department and suppliers inside the caller's organization", async () => {
    const res = await updateRequest(
      request("PUT", procurementBody),
      requestContext,
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.department.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [DEPARTMENT_ID] }, organizationId: CALLER_ORG },
      }),
    );
    expect(mockPrisma.purchaseRequestItem.createMany).toHaveBeenCalled();
  });
});
