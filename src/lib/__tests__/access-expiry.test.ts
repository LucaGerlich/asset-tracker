import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));

import { processAccessExpiry } from "@/lib/access-expiry";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);
const HOUR_MS = 60 * 60 * 1000;

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
