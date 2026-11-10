import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { REQUEST: "REQUEST", APPROVE: "APPROVE", REJECT: "REJECT" },
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    organization: { id: "org-uuid-001" },
  }),
  verifyEntityOrgOwnership: vi.fn().mockResolvedValue(true),
}));

import { POST, PUT } from "@/app/api/requests/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const admin = {
  id: "admin-uuid-001",
  isAdmin: true,
  organizationId: "org-uuid-001",
  orgStatus: "active" as const,
};
const member = { ...admin, id: "user-1", isAdmin: false };

const stored = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: "req-1",
  entityType: "consumable",
  entityId: "cons-1",
  userId: "user-1",
  status,
  quantity: 2,
  updatedAt: new Date(),
  ...overrides,
});

const put = (body: Record<string, unknown>) =>
  PUT(
    createMockRequest("/api/requests", {
      method: "PUT",
      body: { id: "req-1", ...body },
    }) as NextRequest,
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  mockPrisma.itemRequest.updateMany.mockResolvedValue({ count: 1 } as never);
  mockPrisma.consumable.updateMany.mockResolvedValue({ count: 1 } as never);
});

describe("PUT /api/requests status validation and transitions", () => {
  it("rejects a status outside the allowed set", async () => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    for (const status of ["pending", "completed", "bogus", 5]) {
      const res = await put({ status });
      expect(res.status).toBe(400);
    }
    expect(mockPrisma.itemRequest.updateMany).not.toHaveBeenCalled();
  });

  it("approving a pending request decrements the consumable once", async () => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    const res = await put({ status: "approved" });
    expect(res.status).toBe(200);
    expect(mockPrisma.itemRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "req-1", status: "pending" },
      data: expect.objectContaining({ status: "approved" }),
    });
    expect(mockPrisma.consumable.updateMany).toHaveBeenCalledWith({
      where: { consumableid: "cons-1", quantity: { gte: 2 } },
      data: { quantity: { decrement: 2 } },
    });
    expect(mockPrisma.consumable_checkouts.create).toHaveBeenCalledTimes(1);
  });

  it("answers 409 and creates no checkout when the stock is too low", async () => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    mockPrisma.consumable.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await put({ status: "approved" });
    const { body } = await parseResponse<{ error: string }>(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/stock/i);
    expect(mockPrisma.consumable_checkouts.create).not.toHaveBeenCalled();
  });

  it("refuses to approve an already approved request", async () => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("approved") as never,
    );
    const res = await put({ status: "approved" });
    expect(res.status).toBe(409);
    expect(mockPrisma.consumable.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.itemRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["rejected", "approved"],
    ["cancelled", "returned"],
    ["returned", "cancelled"],
    ["approved", "rejected"],
  ])("refuses to move a %s request to %s", async (from, to) => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(stored(from) as never);
    const res = await put({ status: to });
    expect(res.status).toBe(409);
    expect(mockPrisma.itemRequest.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "approved"],
    ["pending", "rejected"],
    ["pending", "cancelled"],
    ["approved", "returned"],
    ["return_pending", "returned"],
    ["return_pending", "cancelled"],
  ])("allows %s -> %s", async (from, to) => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(stored(from) as never);
    const res = await put({ status: to });
    expect(res.status).toBe(200);
  });

  it("returns 409 and skips side effects when a concurrent decision won", async () => {
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    mockPrisma.itemRequest.updateMany.mockResolvedValue({ count: 0 } as never);
    const res = await put({ status: "approved" });
    expect(res.status).toBe(409);
    expect(mockPrisma.consumable.updateMany).not.toHaveBeenCalled();
  });

  it("lets the requester cancel their own pending request", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(member as never);
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(200);
  });

  it("does not let the requester cancel an approved request", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(member as never);
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("approved") as never,
    );
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(409);
    expect(mockPrisma.itemRequest.updateMany).not.toHaveBeenCalled();
  });

  it("does not let a member cancel someone else's request", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue({
      ...member,
      id: "user-2",
    } as never);
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(403);
    expect(mockPrisma.itemRequest.updateMany).not.toHaveBeenCalled();
  });

  it("does not let a member approve their own request", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(member as never);
    mockPrisma.itemRequest.findUnique.mockResolvedValue(
      stored("pending") as never,
    );
    const res = await put({ status: "approved" });
    expect(res.status).toBe(403);
  });
});

describe("POST /api/requests input validation", () => {
  const post = (body: Record<string, unknown>) =>
    POST(
      createMockRequest("/api/requests", {
        method: "POST",
        body: { entityType: "consumable", entityId: "cons-1", ...body },
      }) as NextRequest,
    );

  beforeEach(() => {
    vi.mocked(requireApiAuth).mockResolvedValue(member as never);
    mockPrisma.itemRequest.findFirst.mockResolvedValue(null);
    mockPrisma.itemRequest.create.mockResolvedValue({ id: "req-1" } as never);
  });

  it.each([-3, 0, 1.5, "2", 10_000_000])(
    "rejects quantity %s",
    async (quantity) => {
      const res = await post({ quantity });
      expect(res.status).toBe(400);
      expect(mockPrisma.itemRequest.create).not.toHaveBeenCalled();
    },
  );

  it("answers 409 when the serializable transaction is aborted (P2034)", async () => {
    mockPrisma.itemRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );
    const res = await post({});
    expect(res.status).toBe(409);
  });

  it("rejects unparseable dates", async () => {
    const res = await post({ startDate: "not-a-date" });
    const { body } = await parseResponse<{ error: string }>(res);
    expect(res.status).toBe(400);
    expect(body.error).toBe("Validation failed");
  });

  it("rejects an end date before the start date", async () => {
    const res = await post({
      startDate: "2026-12-10",
      endDate: "2026-12-01",
    });
    expect(res.status).toBe(400);
  });

  it("creates the request with a valid quantity and dates", async () => {
    const res = await post({
      quantity: 3,
      startDate: "2026-12-01",
      endDate: "2026-12-10",
    });
    expect(res.status).toBe(201);
    expect(mockPrisma.itemRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ quantity: 3 }),
    });
  });
});
