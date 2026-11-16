import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({ isValidCronAuth: vi.fn(() => true) }));

import { GET } from "@/app/api/cron/overdue-returns/route";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const mockPrisma = vi.mocked(prisma, true);

function cronRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/cron/overdue-returns", {
    headers: { authorization: "Bearer secret" },
  });
}

function overdueRequest(
  id: string,
  organizationId: string | null = "org-1",
  userid = `user-${id}`,
) {
  return {
    id,
    entityType: "asset",
    entityId: `asset-${id}`,
    endDate: new Date("2026-01-01"),
    user: {
      userid,
      firstname: "Jane",
      lastname: "Doe",
      email: `${userid}@example.com`,
      organizationId,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.userAssets.findFirst.mockResolvedValue({ id: "ua" } as never);
  mockPrisma.asset.findUnique.mockResolvedValue({
    assetname: "Laptop",
  } as never);
  mockPrisma.user.findMany.mockResolvedValue([
    { userid: "admin-1", email: "admin@example.com" },
  ] as never);
});

describe("GET /api/cron/overdue-returns", () => {
  it("queues the user and admin mails and marks the request overdue", async () => {
    mockPrisma.itemRequest.findMany.mockResolvedValue([
      overdueRequest("1"),
    ] as never);

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ overdueCount: 1, notified: 1 });
    const types = mockPrisma.notification_queue.create.mock.calls.map(
      (call) => call[0].data.type,
    );
    expect(types).toEqual(["overdue_return", "overdue_return_admin"]);
    expect(mockPrisma.itemRequest.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: { status: "overdue", updatedAt: expect.any(Date) },
    });
  });

  it("notifies only active admins of the requester's own organization", async () => {
    mockPrisma.itemRequest.findMany.mockResolvedValue([
      overdueRequest("1", "org-1"),
    ] as never);

    await GET(cronRequest());

    expect(mockPrisma.user.findMany.mock.calls[0][0]?.where).toEqual({
      isadmin: true,
      isActive: true,
      organizationId: "org-1",
    });
  });

  it("notifies no admin when the requester has no organization", async () => {
    mockPrisma.itemRequest.findMany.mockResolvedValue([
      overdueRequest("1", null),
    ] as never);

    const res = await GET(cronRequest());

    expect(await res.json()).toMatchObject({ notified: 1 });
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    const types = mockPrisma.notification_queue.create.mock.calls.map(
      (call) => call[0].data.type,
    );
    // The borrower is still reminded; nobody else on the platform is told.
    expect(types).toEqual(["overdue_return"]);
    expect(mockPrisma.itemRequest.update).toHaveBeenCalledTimes(1);
  });

  it("writes the notifications and the status change in one transaction", async () => {
    mockPrisma.itemRequest.findMany.mockResolvedValue([
      overdueRequest("1"),
    ] as never);

    await GET(cronRequest());

    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("keeps processing the remaining items when one item fails", async () => {
    mockPrisma.itemRequest.findMany.mockResolvedValue([
      overdueRequest("1"),
      overdueRequest("2"),
    ] as never);
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(cronRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ overdueCount: 2, notified: 1 });
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
    expect(logger.error).toHaveBeenCalledWith(
      "Overdue returns: item failed",
      expect.objectContaining({ requestId: "1" }),
    );
  });
});
