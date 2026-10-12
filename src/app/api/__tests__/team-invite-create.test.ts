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
const OWN_ROLE = "role-own";
const GLOBAL_ROLE = "role-global";
const FOREIGN_ROLE = "role-of-another-org";

const roleTable = [
  { id: OWN_ROLE, organizationId: ADMIN_ORG },
  { id: GLOBAL_ROLE, organizationId: null },
  { id: FOREIGN_ROLE, organizationId: "other-org-uuid" },
];

type RoleWhere = {
  id: string;
  OR: { organizationId: string | null }[];
};

/** Answers role.findFirst by evaluating the route's where against roleTable. */
function stubRoleTable() {
  mockPrisma.role.findFirst.mockImplementation(((args: { where: RoleWhere }) =>
    Promise.resolve(
      roleTable.find(
        (role) =>
          role.id === args.where.id &&
          args.where.OR.some((c) => c.organizationId === role.organizationId),
      ) ?? null,
    )) as never);
}

function invite(body: Record<string, unknown>) {
  return POST(createMockRequest("/api/team/invite", { method: "POST", body }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.teamInvitation.findFirst.mockResolvedValue(null);
  stubRoleTable();
  mockPrisma.teamInvitation.create.mockResolvedValue({
    id: "invitation-uuid-1",
    token: "secret-token",
    organization: { name: "Org" },
    role: { name: "Technician" },
    inviter: { firstname: "Ada", lastname: "Admin" },
  } as never);
});

describe("POST /api/team/invite", () => {
  it("rejects another org's role with 400", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com", roleId: FOREIGN_ROLE }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.role.findFirst).toHaveBeenCalledWith({
      where: {
        id: FOREIGN_ROLE,
        OR: [{ organizationId: ADMIN_ORG }, { organizationId: null }],
      },
    });
    expect(mockPrisma.teamInvitation.create).not.toHaveBeenCalled();
  });

  it("rejects an unknown roleId with 400", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com", roleId: "does-not-exist" }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.teamInvitation.create).not.toHaveBeenCalled();
  });

  it("accepts a global role", async () => {
    const { status } = await parseResponse(
      await invite({ email: "new@example.com", roleId: GLOBAL_ROLE }),
    );

    expect(status).toBe(201);
    expect(mockPrisma.teamInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ roleId: GLOBAL_ROLE }),
      }),
    );
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
    const { status, body } = await parseResponse<Record<string, unknown>>(
      await invite({ email: "new@example.com", roleId: OWN_ROLE }),
    );

    expect(status).toBe(201);
    expect(body).not.toHaveProperty("token");
    expect(mockPrisma.teamInvitation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          roleId: OWN_ROLE,
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
