import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));

import { processAccessExpiry } from "@/lib/access-expiry";
import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";

const mockPrisma = vi.mocked(prisma, true);
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findMany.mockResolvedValue([]);
});

describe("processAccessExpiry duplicate-warning window", () => {
  it("looks back further than the 24h cron period", async () => {
    // Query order: expired users, then the 1-day warnings, then the 7-day ones.
    mockPrisma.user.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        userid: "u1",
        firstname: "A",
        lastname: "B",
        email: "a@example.com",
        accessExpiresAt: new Date(Date.now() + 12 * HOUR_MS),
      },
    ] as never);

    await processAccessExpiry();

    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as { createdAt: { gte: Date } };
    const lookbackMs = Date.now() - where.createdAt.gte.getTime();
    // A cron firing a few minutes early must still see yesterday's warning.
    expect(lookbackMs).toBeGreaterThanOrEqual(29 * HOUR_MS);
    expect(lookbackMs).toBeLessThan(31 * HOUR_MS);
  });
});

describe("processAccessExpiry 7-day warning fires once", () => {
  const expiresAt = new Date(Date.now() + 5 * DAY_MS);
  const user = {
    userid: "u7",
    firstname: "A",
    lastname: "B",
    email: "a@example.com",
    accessExpiresAt: expiresAt,
  };

  beforeEach(() => {
    // Query order: expired users, 1-day warnings, then the 7-day ones.
    mockPrisma.user.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([user] as never);
  });

  it("dedupes per user and expiry date over a window longer than the warning band", async () => {
    mockPrisma.notification_queue.findFirst.mockResolvedValue(null);

    const result = await processAccessExpiry();

    expect(result.notified7d).toBe(1);
    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as {
      userId: string;
      type: string;
      body: { contains: string };
      createdAt: { gte: Date };
    };
    const marker = `ref:u7:${expiresAt.toISOString().slice(0, 10)}`;
    expect(where).toMatchObject({
      userId: "u7",
      type: "access_expiry_7d",
      body: { contains: marker },
    });
    // The band spans 6 days, so the look-back must cover all of it.
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(
      7 * DAY_MS,
    );
    expect(vi.mocked(queueEmail).mock.calls[0][4]).toContain(marker);
  });

  it("does not warn again once the warning was queued", async () => {
    mockPrisma.notification_queue.findFirst.mockResolvedValue({
      id: "q1",
    } as never);

    const result = await processAccessExpiry();

    expect(result.notified7d).toBe(0);
    expect(queueEmail).not.toHaveBeenCalled();
  });
});
