import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", () => ({ queueEmail: vi.fn() }));
vi.mock("@/lib/report-generator", () => ({
  generateReportBuffer: vi.fn(),
}));

import { processScheduledReports } from "@/lib/scheduled-reports";
import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";
import { generateReportBuffer } from "@/lib/report-generator";

const mockPrisma = vi.mocked(prisma, true);
const mockGenerate = vi.mocked(generateReportBuffer);
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
  mockGenerate.mockResolvedValue({
    buffer: Buffer.from("a,b"),
    mimeType: "text/csv",
    extension: "csv",
    filename: "assets-report.csv",
  } as never);
});

describe("processScheduledReports organization binding", () => {
  it("generates the report for a schedule in the user's current org", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", "org-a"),
    ] as never);

    const result = await processScheduledReports();

    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0 });
    expect(mockGenerate).toHaveBeenCalledWith("assets", "csv", "org-a");
    expect(mockQueueEmail).toHaveBeenCalledTimes(1);
  });

  it("deactivates and skips a schedule whose user moved to another org", async () => {
    mockPrisma.reportSchedule.findMany.mockResolvedValue([
      schedule("org-a", "org-b"),
    ] as never);

    const result = await processScheduledReports();

    expect(result.succeeded).toBe(0);
    expect(mockGenerate).not.toHaveBeenCalled();
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

    expect(mockGenerate).not.toHaveBeenCalled();
    expect(mockQueueEmail).not.toHaveBeenCalled();
  });
});
