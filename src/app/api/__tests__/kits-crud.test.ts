import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

// Mock all dependencies BEFORE importing the route
vi.mock("@/lib/prisma");

vi.mock("@/lib/api-auth");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  scopeToOrganization: vi.fn((where: any) => ({
    ...where,
    organizationId: "org-uuid-001",
  })),
}));

vi.mock("@/lib/validations", () => ({
  validateBody: vi.fn((_schema: any, body: any) => body),
  createKitSchema: {},
  updateKitSchema: {},
}));

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create", UPDATE: "update", DELETE: "delete" },
  AUDIT_ENTITIES: { KIT: "kit" },
}));

vi.mock("@/lib/logger");

vi.mock("@/lib/pagination", () => ({
  parsePaginationParams: vi
    .fn()
    .mockReturnValue({ page: 1, pageSize: 25, search: null }),
  buildPrismaArgs: vi.fn().mockReturnValue({ skip: 0, take: 25 }),
  buildPaginatedResponse: vi.fn((items: any, total: number) => ({
    data: items,
    total,
  })),
}));

import { GET, POST, PUT, DELETE } from "@/app/api/kits/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);
const mockRequirePermission = vi.mocked(requirePermission);

const mockKit = {
  id: "kit-uuid-001",
  name: "Developer Kit",
  description: "Standard dev setup",
  isActive: true,
  organizationId: "org-uuid-001",
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: "item-1",
      kitId: "kit-uuid-001",
      entityType: "asset_category",
      entityId: "550e8400-e29b-41d4-a716-446655440000",
      quantity: 1,
      isRequired: true,
      notes: null,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockRequirePermission.mockResolvedValue({
    id: "admin-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
  } as any);
});

// ---------------------------------------------------------------------------
// GET /api/kits
// ---------------------------------------------------------------------------
describe("GET /api/kits", () => {
  it("returns all kits when no page param", async () => {
    mockPrisma.kit.findMany.mockResolvedValue([mockKit] as any);

    const req = createMockRequest("/api/kits");
    const res = await GET(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0].name).toBe("Developer Kit");
  });

  it("returns 401 when unauthorized", async () => {
    mockRequirePermission.mockRejectedValue(new Error("Unauthorized"));

    const req = createMockRequest("/api/kits");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/kits
// ---------------------------------------------------------------------------
describe("POST /api/kits", () => {
  it("creates a kit with items and returns 201", async () => {
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
    mockPrisma.kit.create.mockResolvedValue({
      ...mockKit,
      items: undefined,
    } as any);
    mockPrisma.kit.findUnique.mockResolvedValue(mockKit as any);

    const req = createMockRequest("/api/kits", {
      method: "POST",
      body: {
        name: "Developer Kit",
        description: "Standard dev setup",
        isActive: true,
        items: [
          {
            entityType: "asset_category",
            entityId: "550e8400-e29b-41d4-a716-446655440000",
            quantity: 1,
            isRequired: true,
          },
        ],
      },
    });
    const res = await POST(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(201);
    expect(body.name).toBe("Developer Kit");
    expect(mockPrisma.kit.create).toHaveBeenCalled();
    expect(mockPrisma.kitItem.createMany).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT /api/kits
// ---------------------------------------------------------------------------
describe("PUT /api/kits", () => {
  it("updates a kit and returns 200", async () => {
    vi.mocked(mockPrisma.$transaction).mockImplementation(async (cb: any) =>
      cb(mockPrisma),
    );
    const updatedKit = { ...mockKit, name: "Updated Kit" };
    mockPrisma.kit.findFirst.mockResolvedValue(mockKit as any);
    mockPrisma.kit.update.mockResolvedValue(updatedKit as any);
    mockPrisma.kit.findUnique.mockResolvedValue(updatedKit as any);

    const req = createMockRequest("/api/kits", {
      method: "PUT",
      body: { id: "kit-uuid-001", name: "Updated Kit" },
    });
    const res = await PUT(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.name).toBe("Updated Kit");
    expect(mockPrisma.kit.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "kit-uuid-001" } }),
    );
  });

  it("returns 400 when id is missing", async () => {
    const req = createMockRequest("/api/kits", {
      method: "PUT",
      body: { name: "No Id Kit" },
    });
    const res = await PUT(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(400);
    expect(body.error).toBe("Kit ID is required");
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/kits
// ---------------------------------------------------------------------------
describe("DELETE /api/kits", () => {
  it("deletes a kit and returns 200", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue({
      name: "Developer Kit",
    } as any);
    mockPrisma.kit.delete.mockResolvedValue(mockKit as any);

    const req = createMockRequest("/api/kits", {
      method: "DELETE",
      body: { id: "kit-uuid-001" },
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(200);
    expect(body.message).toBe("Kit deleted successfully");
    expect(mockPrisma.kit.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "kit-uuid-001" } }),
    );
  });

  it("returns 404 when kit not found", async () => {
    mockPrisma.kit.findFirst.mockResolvedValue(null);

    const req = createMockRequest("/api/kits", {
      method: "DELETE",
      body: { id: "nonexistent" },
    });
    const res = await DELETE(req);
    const { status, body } = await parseResponse<any>(res);

    expect(status).toBe(404);
    expect(body.error).toBe("Kit not found");
  });
});
