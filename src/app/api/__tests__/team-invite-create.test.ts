import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/email/service", () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));

import { POST } from "@/app/api/team/invite/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

// Matches the organizationId of the default mocked admin in lib/__mocks__/api-auth.
const ADMIN_ORG = "org-uuid-001";
const FOREIGN_ROLE = "role-of-another-org";

function invite(body: Record<string, unknown>) {
  return POST(createMockRequest("/api/team/invite", { method: "POST", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
  mockPrisma.role.findFirst.mockResolvedValue(null);
  mockPrisma.teamInvitation.create.mockResolvedValue({
    id: "invitation-uuid-1",
    token: "secret-token",
    organization: { name: "Org" },
    role: { name: "Technician" },
    inviter: { firstname: "Ada", lastname: "Admin" },
  } as never);
});

describe("POST /api/team/invite", () => {
  it("rejects a roleId that does not belong to the inviter's org with 400", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com", roleId: FOREIGN_ROLE }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: { id: FOREIGN_ROLE, organizationId: ADMIN_ORG },
    });
    expect(mockPrisma.teamInvitation.create).not.toHaveBeenCalled();
  });

  it("rejects a non-string roleId with 400 instead of querying with it", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com", roleId: { not: "" } }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.role.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.teamInvitation.create).not.toHaveBeenCalled();
  });

  it("creates the invitation when the role belongs to the inviter's org", async () => {
    mockPrisma.role.findFirst.mockResolvedValue({ id: "role-own" } as never);

    const { status, body } = await parseResponse<Record<string, unknown>>(
      await invite({ email: "new@example.com", roleId: "role-own" }),
    );

    expect(status).toBe(201);
    expect(body).not.toHaveProperty("token");
    expect(mockPrisma.teamInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roleId: "role-own",
          organizationId: ADMIN_ORG,
        }),
      }),
    );
  });

  it("creates a role-less invitation without a role lookup", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com" }),
    );

    expect(status).toBe(201);
    expect(mockPrisma.role.findFirst).not.toHaveBeenCalled();
  });
});
