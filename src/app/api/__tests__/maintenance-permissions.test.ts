import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

import { POST } from "@/app/api/maintenance/route";
import { PUT, DELETE } from "@/app/api/maintenance/[id]/route";
import prisma from "@/lib/prisma";
import { requireApiAuth, requirePermission } from "@/lib/api-auth";
import { ForbiddenError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);
const params = { params: Promise.resolve({ id: "sched-1" }) };

beforeEach(() => {
  vi.clearAllMocks();
  // A plain member: authenticated, but lacking the write permission.
  vi.mocked(requireApiAuth).mockResolvedValue({
    id: "member-1",
    isAdmin: false,
    organizationId: "org-uuid-001",
  } as never);
  vi.mocked(requirePermission).mockRejectedValue(
    new ForbiddenError(
      "insufficient_permission",
      "Missing permission: asset:edit",
    ),
  );
});

describe("maintenance schedule writes require asset:edit", () => {
  it("POST /api/maintenance", async () => {
    const res = await POST(
      createMockRequest("/api/maintenance", {
        method: "POST",
        body: {
          title: "Service",
          assetId: "asset-1",
          frequency: "monthly",
          nextDueDate: "2026-12-01",
        },
      }),
    );
    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(mockPrisma.maintenance_schedules.create).not.toHaveBeenCalled();
  });

  it("PUT /api/maintenance/[id]", async () => {
    const res = await PUT(
      createMockRequest("/api/maintenance/sched-1", {
        method: "PUT",
        body: { title: "Renamed" },
      }),
      params,
    );
    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(mockPrisma.maintenance_schedules.update).not.toHaveBeenCalled();
  });

  it("DELETE /api/maintenance/[id]", async () => {
    const res = await DELETE(
      createMockRequest("/api/maintenance/sched-1", { method: "DELETE" }),
      params,
    );
    expect(res.status).toBe(403);
    expect(requirePermission).toHaveBeenCalledWith("asset:edit");
    expect(mockPrisma.maintenance_schedules.delete).not.toHaveBeenCalled();
  });
});
