import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn().mockResolvedValue({
    userId: "user-uuid-001",
    organization: { id: "org-uuid-001", name: "Test Org" },
  }),
}));

import { POST, PUT } from "@/app/api/report-schedules/route";
import prisma from "@/lib/prisma";
import { requirePermission } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const SCHEDULE_ID = "11111111-1111-4111-8111-111111111111";
const url = "/api/report-schedules";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.reportSchedule.findFirst.mockResolvedValue({
    id: SCHEDULE_ID,
  } as never);
  mockPrisma.reportSchedule.create.mockResolvedValue({ id: "new" } as never);
  mockPrisma.reportSchedule.update.mockResolvedValue({
    id: SCHEDULE_ID,
  } as never);
});

describe("report-schedules permissions", () => {
  const denied = () =>
    vi
      .mocked(requirePermission)
      .mockRejectedValueOnce(
        new ForbiddenError(
          "insufficient_permission",
          "Insufficient permissions",
        ),
      );

  it("POST requires the report:view permission", async () => {
    mockPrisma.reportSchedule.findFirst.mockResolvedValue(null);
    await POST(
      createMockRequest(url, {
        method: "POST",
        body: { reportType: "summary", frequency: "daily", format: "csv" },
      }),
    );

    expect(requirePermission).toHaveBeenCalledWith("report:view");
  });

  it("POST returns 403 without the permission", async () => {
    denied();

    const res = await POST(
      createMockRequest(url, {
        method: "POST",
        body: { reportType: "summary", frequency: "daily", format: "csv" },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.reportSchedule.create).not.toHaveBeenCalled();
  });

  it("PUT returns 403 without the permission", async () => {
    denied();

    const res = await PUT(
      createMockRequest(url, {
        method: "PUT",
        body: { id: SCHEDULE_ID, isActive: false },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockPrisma.reportSchedule.update).not.toHaveBeenCalled();
  });
});

describe("PUT /api/report-schedules validation", () => {
  const put = (body: Record<string, unknown>) =>
    PUT(createMockRequest(url, { method: "PUT", body }));

  it.each([
    ["an invalid frequency", { id: SCHEDULE_ID, frequency: "hourly" }],
    ["an invalid format", { id: SCHEDULE_ID, format: "exe" }],
    ["a non-boolean isActive", { id: SCHEDULE_ID, isActive: "yes" }],
    ["a non-uuid id", { id: "not-a-uuid", isActive: false }],
    ["a missing id", { isActive: false }],
  ])("rejects %s", async (_label, body) => {
    const { status } = await parseResponse(await put(body));

    expect(status).toBe(400);
    expect(mockPrisma.reportSchedule.update).not.toHaveBeenCalled();
  });

  it("applies a valid partial update", async () => {
    const { status } = await parseResponse(
      await put({ id: SCHEDULE_ID, frequency: "weekly" }),
    );

    expect(status).toBe(200);
    const data = mockPrisma.reportSchedule.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ frequency: "weekly" });
    expect(data).not.toHaveProperty("format");
  });
});
