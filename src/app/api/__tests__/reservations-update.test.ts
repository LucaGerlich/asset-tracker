import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { APPROVE: "APPROVE", REJECT: "REJECT", UPDATE: "UPDATE" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));

import { PUT } from "@/app/api/reservations/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const ORG = "org-uuid-001";
const admin = {
  id: "admin-1",
  isAdmin: true,
  organizationId: ORG,
  orgStatus: "active" as const,
};
const owner = { ...admin, id: "owner-1", isAdmin: false };
const other = { ...admin, id: "other-1", isAdmin: false };

const stored = (status: string) => ({
  id: "res-1",
  assetId: "asset-1",
  userId: "owner-1",
  status,
  startDate: new Date("2026-12-01T09:00:00Z"),
  endDate: new Date("2026-12-02T09:00:00Z"),
  asset: { assetname: "Laptop", organizationId: ORG },
  user: { firstname: "O", lastname: "W" },
});

const put = (body: Record<string, unknown>) =>
  PUT(
    createMockRequest("/api/reservations/res-1", {
      method: "PUT",
      body,
    }) as NextRequest,
    { params: Promise.resolve({ id: "res-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireApiAuth).mockResolvedValue(admin as never);
  mockPrisma.assetReservation.findFirst.mockResolvedValue(null);
  mockPrisma.assetReservation.updateMany.mockResolvedValue({
    count: 1,
  } as never);
});

const existing = (status: string) =>
  mockPrisma.assetReservation.findUnique.mockResolvedValue(
    stored(status) as never,
  );

describe("PUT /api/reservations/[id] ownership", () => {
  it.each(["pending", "completed", "cancelled", "approved"])(
    "a member cannot set %s on someone else's reservation",
    async (status) => {
      vi.mocked(requireApiAuth).mockResolvedValue(other as never);
      existing("pending");
      const res = await put({ status });
      expect(res.status).toBe(403);
      expect(mockPrisma.assetReservation.updateMany).not.toHaveBeenCalled();
    },
  );

  it("a member cannot edit notes of someone else's reservation", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(other as never);
    existing("pending");
    const res = await put({ notes: "hijacked" });
    expect(res.status).toBe(403);
  });

  it.each(["pending", "completed", "approved", "rejected"])(
    "the owner cannot set %s on their own reservation",
    async (status) => {
      vi.mocked(requireApiAuth).mockResolvedValue(owner as never);
      existing("pending");
      const res = await put({ status });
      expect(res.status).toBe(403);
    },
  );

  it("the owner can cancel their own reservation", async () => {
    vi.mocked(requireApiAuth).mockResolvedValue(owner as never);
    existing("pending");
    mockPrisma.assetReservation.findUniqueOrThrow.mockResolvedValue(
      stored("cancelled") as never,
    );
    const res = await put({ status: "cancelled" });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/reservations/[id] transitions", () => {
  it.each([
    ["cancelled", "approved"],
    ["rejected", "approved"],
    ["completed", "approved"],
    ["completed", "cancelled"],
    ["pending", "completed"],
  ])("refuses %s -> %s", async (from, to) => {
    existing(from);
    const res = await put({ status: to });
    expect(res.status).toBe(409);
    expect(mockPrisma.assetReservation.updateMany).not.toHaveBeenCalled();
  });

  it.each([
    ["pending", "approved"],
    ["pending", "rejected"],
    ["pending", "cancelled"],
    ["approved", "cancelled"],
    ["approved", "completed"],
  ])("allows %s -> %s", async (from, to) => {
    existing(from);
    mockPrisma.assetReservation.findUniqueOrThrow.mockResolvedValue(
      stored(to) as never,
    );
    const res = await put({ status: to });
    expect(res.status).toBe(200);
    expect(mockPrisma.assetReservation.updateMany).toHaveBeenCalledWith({
      where: { id: "res-1", status: from },
      data: expect.objectContaining({ status: to }),
    });
  });

  it("returns 409 when a concurrent update won", async () => {
    existing("pending");
    mockPrisma.assetReservation.updateMany.mockResolvedValue({
      count: 0,
    } as never);
    const res = await put({ status: "approved" });
    expect(res.status).toBe(409);
  });

  it("refuses to approve when another active reservation overlaps", async () => {
    existing("pending");
    mockPrisma.assetReservation.findFirst.mockResolvedValue({
      id: "res-2",
    } as never);
    const res = await put({ status: "approved" });
    expect(res.status).toBe(409);
    expect(mockPrisma.assetReservation.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        assetId: "asset-1",
        id: { not: "res-1" },
        status: { in: ["pending", "approved"] },
        startDate: { lte: stored("pending").endDate },
        endDate: { gte: stored("pending").startDate },
      }),
      select: { id: true },
    });
    expect(mockPrisma.assetReservation.updateMany).not.toHaveBeenCalled();
  });
});
