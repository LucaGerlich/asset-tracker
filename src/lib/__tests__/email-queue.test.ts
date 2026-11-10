import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");

const send = vi.fn();
vi.mock("@/lib/email/providers", () => ({
  createEmailProvider: vi.fn(() => ({ send })),
}));

import { processEmailQueue } from "@/lib/email/service";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

function queued(id: string) {
  return {
    id,
    recipient: `${id}@example.com`,
    subject: "s",
    body: "b",
    type: "t",
    attempts: 0,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("EMAIL_PROVIDER", "brevo");
  vi.stubEnv("EMAIL_FROM", "noreply@example.com");
  send.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("processEmailQueue", () => {
  it("keeps draining batches until the queue is empty", async () => {
    mockPrisma.notification_queue.findMany
      .mockResolvedValueOnce([queued("a"), queued("b")] as never)
      .mockResolvedValueOnce([queued("c")] as never);

    const result = await processEmailQueue({ batchSize: 2 });

    expect(result).toEqual({ processed: 3, succeeded: 3, failed: 0 });
    expect(mockPrisma.notification_queue.findMany).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("does not pick an email up twice within one run", async () => {
    send.mockResolvedValue({ success: false, error: "boom" });
    mockPrisma.notification_queue.findMany
      .mockResolvedValueOnce([queued("a"), queued("b")] as never)
      .mockResolvedValueOnce([] as never);

    await processEmailQueue({ batchSize: 2 });

    const secondWhere = mockPrisma.notification_queue.findMany.mock.calls[1][0]
      ?.where as { id: { notIn: string[] } };
    expect(secondWhere.id.notIn).toEqual(["a", "b"]);
  });

  it("sends nothing once the deadline has passed", async () => {
    mockPrisma.notification_queue.findMany.mockResolvedValue([
      queued("a"),
      queued("b"),
    ] as never);

    const result = await processEmailQueue({
      batchSize: 2,
      deadline: Date.now() - 1,
    });

    expect(result).toEqual({ processed: 0, succeeded: 0, failed: 0 });
    expect(send).not.toHaveBeenCalled();
  });

  it("checks the deadline before each email, not only between batches", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-11-03T10:00:00Z"));
      const deadline = Date.now() + 1000;
      mockPrisma.notification_queue.findMany.mockResolvedValue([
        queued("a"),
        queued("b"),
        queued("c"),
      ] as never);
      // The first send eats the remaining budget.
      send.mockImplementationOnce(async () => {
        vi.setSystemTime(deadline + 1);
        return { success: true };
      });

      const result = await processEmailQueue({ batchSize: 3, deadline });

      expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
      expect(send).toHaveBeenCalledTimes(1);
      expect(mockPrisma.notification_queue.findMany).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("sends more than ten emails per run by default", async () => {
    const batch = Array.from({ length: 25 }, (_, i) => queued(`e${i}`));
    mockPrisma.notification_queue.findMany
      .mockResolvedValueOnce(batch as never)
      .mockResolvedValueOnce([] as never);

    const result = await processEmailQueue();

    expect(result.processed).toBe(25);
    expect(mockPrisma.notification_queue.findMany.mock.calls[0][0]?.take).toBe(
      25,
    );
  });
});
