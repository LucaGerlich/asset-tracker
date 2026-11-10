import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({
  isValidCronAuth: vi.fn().mockReturnValue(true),
}));
vi.mock("@/lib/notifications", () => ({
  runNotificationChecks: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  processEmailQueue: vi.fn(),
}));

import { GET } from "@/app/api/cron/notifications/route";
import { runNotificationChecks } from "@/lib/notifications";
import { processEmailQueue } from "@/lib/email";

const NOW = new Date("2026-11-03T10:00:00Z");

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.mocked(processEmailQueue).mockResolvedValue({
    processed: 0,
    succeeded: 0,
    failed: 0,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/cron/notifications", () => {
  it("derives the mail deadline from the route start, not from after the checks", async () => {
    vi.mocked(runNotificationChecks).mockImplementation(async () => {
      // The checks use up 20s of the 60s function budget.
      vi.setSystemTime(NOW.getTime() + 20_000);
      return {} as never;
    });

    const res = await GET(createMockRequest("/api/cron/notifications"));

    expect(res.status).toBe(200);
    const options = vi.mocked(processEmailQueue).mock.calls[0][0];
    expect(options?.deadline).toBe(NOW.getTime() + 45_000);
  });
});
