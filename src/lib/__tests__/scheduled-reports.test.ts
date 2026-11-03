import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));
vi.mock("@/lib/url", () => ({ getBaseUrl: () => "https://app.example.com" }));

import { processScheduledReports } from "@/lib/scheduled-reports";
import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";

const mockPrisma = vi.mocked(prisma, true);
const mockQueueEmail = vi.mocked(queueEmail);

function schedule(scheduleOrg: string | null, userOrg: string | null) {
  return {
    id: "sched-1",
    userId: "user-1",
    organizationId: scheduleOrg,
    reportType: "assets",
    frequency: "weekly",
    format: "csv",
    isActive: true,
    user: {
      userid: "user-1",
      firstname: "Jane",
      lastname: "Doe",
      email: "jane@example.com",
      isActive: true,
      organizationId: userOrg,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("processScheduledReports organization binding", () => {
  it("generates the report for a schedule in the user's current org", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", "org-a"),
    ] as never);

    const result = await processScheduledReports();

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(mockQueueEmail).toHaveBeenCalledTimes(1);
  });

  it("links into the app instead of embedding the file as a data: URI", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", "org-a"),
    ] as never);

    await processScheduledReports();

    const html = mockQueueEmail.mock.calls[0][4];
    expect(html).toContain('href="https://app.example.com/reports"');
    expect(html).not.toContain("data:");
    expect(html).not.toContain("base64");
  });

  it("deactivates and skips a schedule whose user moved to another org", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", "org-b"),
    ] as never);

    const result = await processScheduledReports();

    expect(result.succeeded).toBe(0);
    expect(mockQueueEmail).not.toHaveBeenCalled();
    expect(mockPrisma.reportSchedule.update).toHaveBeenCalledWith({
      where: { id: "sched-1" },
      data: { isActive: false },
    });
  });

  it("skips a schedule whose user has no organization any more", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", null),
    ] as never);

    await processScheduledReports();

    expect(mockQueueEmail).not.toHaveBeenCalled();
  });
});
