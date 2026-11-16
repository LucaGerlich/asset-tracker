import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/email/service", () => ({
  queueEmail: vi.fn().mockResolvedValue(undefined),
}));

import { POST as complete } from "@/app/api/maintenance/[id]/complete/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const NOW = new Date("2026-11-03T10:00:00Z");

const schedule = (nextDueDate: string, frequency = "monthly") => ({
  id: "sched-1",
  assetId: "asset-1",
  title: "Service",
  frequency,
  nextDueDate: new Date(nextDueDate),
  assignedTo: null,
});

const post = () =>
  complete(
    createMockRequest("/api/maintenance/sched-1/complete", {
      method: "POST",
      body: { notes: "done" },
    }),
    { params: Promise.resolve({ id: "sched-1" }) },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  mockPrisma.maintenance_schedules.updateMany.mockResolvedValue({
    count: 1,
  } as never);
  mockPrisma.maintenance_logs.create.mockResolvedValue({
    id: "log-1",
  } as never);
  mockPrisma.maintenance_schedules.findUniqueOrThrow.mockResolvedValue({
    ...schedule("2026-12-03T10:00:00Z"),
    user: null,
    asset: { assetname: "Laptop" },
  } as never);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/maintenance/[id]/complete", () => {
  it("advances an overdue schedule from now, not from its stale due date", async () => {
    mockPrisma.maintenance_schedules.findFirst.mockResolvedValue(
      schedule("2026-05-01T08:00:00Z") as never,
    );

    const res = await post();

    expect(res.status).toBe(201);
    expect(mockPrisma.maintenance_schedules.updateMany).toHaveBeenCalledWith({
      where: { id: "sched-1", nextDueDate: new Date("2026-05-01T08:00:00Z") },
      data: expect.objectContaining({
        nextDueDate: new Date("2026-12-03T10:00:00Z"),
        lastCompletedAt: NOW,
      }),
    });
  });

  it("clamps the day of month for month-end schedules", async () => {
    mockPrisma.maintenance_schedules.findFirst.mockResolvedValue(
      schedule("2027-01-31T08:00:00Z") as never,
    );

    await post();

    expect(mockPrisma.maintenance_schedules.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          nextDueDate: new Date("2027-02-28T08:00:00Z"),
        }),
      }),
    );
  });

  it("returns 409 and writes no log when the schedule was completed concurrently", async () => {
    mockPrisma.maintenance_schedules.findFirst.mockResolvedValue(
      schedule("2026-11-20T08:00:00Z") as never,
    );
    mockPrisma.maintenance_schedules.updateMany.mockResolvedValue({
      count: 0,
    } as never);

    const res = await post();

    expect(res.status).toBe(409);
    expect(mockPrisma.maintenance_logs.create).not.toHaveBeenCalled();
  });
});
