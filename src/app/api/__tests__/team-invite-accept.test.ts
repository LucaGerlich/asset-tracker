import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

vi.mock("@/lib/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/auth-utils", () => ({
  setUserPassword: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));

import { GET, POST } from "@/app/api/team/invite/[token]/route";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { checkUserLimit } from "@/lib/tenant-limits";

const mockPrisma = vi.mocked(prisma, true);
const mockGetSession = vi.mocked(auth.api.getSession);
const mockCheckUserLimit = vi.mocked(checkUserLimit);

const INVITE_ORG = "org-b-uuid";
const OTHER_ORG = "org-a-uuid";
const INVITEE_EMAIL = "invitee@example.com";
const TOKEN = "invite-token-1";

type InviteStatus = "pending" | "accepted" | "revoked" | "cancelled";

function invitation(overrides: { status?: InviteStatus; expired?: boolean }) {
  const { status = "pending", expired = false } = overrides;
  return {
    id: "invitation-uuid-1",
    email: INVITEE_EMAIL,
    status,
    token: TOKEN,
    invitedBy: "admin-uuid-b",
    expiresAt: new Date(Date.now() + (expired ? -1 : 1) * 60 * 60 * 1000),
    createdAt: new Date(),
    organization: { id: INVITE_ORG, name: "Org B" },
    role: { id: "role-b-uuid", name: "Technician" },
    inviter: { firstname: "Ada", lastname: "Admin" },
  };
}

const params = { params: Promise.resolve({ token: TOKEN }) };

function accept(body: Record<string, unknown> = {}) {
  return POST(
    createMockRequest(`/api/team/invite/${TOKEN}`, { method: "POST", body }),
    params,
  );
}

function signedInAs(email: string) {
  mockGetSession.mockResolvedValue({ user: { email } } as never);
}

function existingUserIn(organizationId: string | null, isadmin = true) {
  mockPrisma.user.findFirst.mockResolvedValue({
    userid: "user-uuid-1",
    email: INVITEE_EMAIL,
    organizationId,
    isadmin,
  } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckUserLimit.mockResolvedValue({
    allowed: true,
    current: 0,
    max: -1,
  });
  mockPrisma.teamInvitation.findUnique.mockResolvedValue(
    invitation({}) as never,
  );
  mockPrisma.user.findFirst.mockResolvedValue(null);
  mockGetSession.mockResolvedValue(null);
});

describe("invitation status validation", () => {
  it.each<InviteStatus>(["cancelled", "revoked", "accepted"])(
    "rejects a %s invitation on accept with 410",
    async (status) => {
      mockPrisma.teamInvitation.findUnique.mockResolvedValue(
        invitation({ status }) as never,
      );

      const { status: httpStatus } = await parseResponse(await accept());

      expect(httpStatus).toBe(410);
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
      expect(mockPrisma.teamInvitation.update).not.toHaveBeenCalled();
    },
  );

  it("rejects a cancelled invitation on lookup with 410", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(
      invitation({ status: "cancelled" }) as never,
    );

    const res = await GET(
      createMockRequest(`/api/team/invite/${TOKEN}`),
      params,
    );

    expect(res.status).toBe(410);
  });

  it("rejects an expired pending invitation with 410", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(
      invitation({ expired: true }) as never,
    );

    const { status } = await parseResponse(await accept());

    expect(status).toBe(410);
  });

  it("returns 404 for an unknown token", async () => {
    mockPrisma.teamInvitation.findUnique.mockResolvedValue(null);

    const { status } = await parseResponse(await accept());

    expect(status).toBe(404);
  });
});

describe("accepting as an existing user", () => {
  it("requires a session for the invited email", async () => {
    existingUserIn(OTHER_ORG);
    signedInAs("someone-else@example.com");

    const { status } = await parseResponse(await accept());

    expect(status).toBe(401);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("moves a user from another org with isadmin false and drops foreign roles", async () => {
    existingUserIn(OTHER_ORG, true);
    signedInAs(INVITEE_EMAIL);

    const { status } = await parseResponse(await accept());

    expect(status).toBe(200);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { userid: "user-uuid-1" },
      data: { organizationId: INVITE_ORG, isadmin: false, departmentId: null },
    });
    expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: "user-uuid-1",
        role: {
          AND: [
            { organizationId: { not: null } },
            { organizationId: { not: INVITE_ORG } },
          ],
        },
      },
    });
    expect(mockPrisma.userRole.upsert).toHaveBeenCalledTimes(1);
    expect(mockPrisma.teamInvitation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "invitation-uuid-1" },
        data: expect.objectContaining({ status: "accepted" }),
      }),
    );
  });

  it("revokes the old admin flag and roles before the invited role is granted", async () => {
    existingUserIn(OTHER_ORG, true);
    signedInAs(INVITEE_EMAIL);
    const order: string[] = [];
    mockPrisma.user.update.mockImplementation((() => {
      order.push("user.update");
      return Promise.resolve({});
    }) as never);
    mockPrisma.userRole.deleteMany.mockImplementation((() => {
      order.push("userRole.deleteMany");
      return Promise.resolve({ count: 1 });
    }) as never);
    mockPrisma.userRole.upsert.mockImplementation((() => {
      order.push("userRole.upsert");
      return Promise.resolve({});
    }) as never);

    await accept();

    expect(order).toEqual([
      "user.update",
      "userRole.deleteMany",
      "userRole.upsert",
    ]);
  });

  it("moves a user without an organization the same way", async () => {
    existingUserIn(null, false);
    signedInAs(INVITEE_EMAIL);

    const { status } = await parseResponse(await accept());

    expect(status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: INVITE_ORG,
          isadmin: false,
        }),
      }),
    );
    expect(mockPrisma.userRole.deleteMany).toHaveBeenCalledTimes(1);
  });

  it("does not demote or strip roles of a user already in the invite's org", async () => {
    existingUserIn(INVITE_ORG, true);
    signedInAs(INVITEE_EMAIL);

    const { status } = await parseResponse(await accept());

    expect(status).toBe(200);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.userRole.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.userRole.upsert).toHaveBeenCalledTimes(1);
    expect(mockCheckUserLimit).not.toHaveBeenCalled();
  });

  it("returns 403 and changes nothing when the invite's org is at its user limit", async () => {
    existingUserIn(OTHER_ORG);
    signedInAs(INVITEE_EMAIL);
    mockCheckUserLimit.mockResolvedValue({
      allowed: false,
      current: 5,
      max: 5,
    });

    const { status } = await parseResponse(await accept());

    expect(status).toBe(403);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.userRole.deleteMany).not.toHaveBeenCalled();
    expect(mockPrisma.teamInvitation.update).not.toHaveBeenCalled();
  });
});

describe("accepting as a new user", () => {
  const newUserBody = {
    firstname: "New",
    lastname: "Person",
    password: "SecurePass123!",
  };

  it("creates the user in the invite's org as a non-admin", async () => {
    mockPrisma.user.create.mockResolvedValue({
      userid: "new-user-uuid",
    } as never);

    const { status } = await parseResponse(await accept(newUserBody));

    expect(status).toBe(200);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: INVITE_ORG,
        isadmin: false,
        email: INVITEE_EMAIL,
      }),
    });
  });

  it("returns 403 and creates nothing when the invite's org is at its user limit", async () => {
    mockCheckUserLimit.mockResolvedValue({
      allowed: false,
      current: 5,
      max: 5,
    });

    const { status } = await parseResponse(await accept(newUserBody));

    expect(status).toBe(403);
    expect(mockCheckUserLimit).toHaveBeenCalledWith(INVITE_ORG);
    expect(mockPrisma.user.create).not.toHaveBeenCalled();
    expect(mockPrisma.teamInvitation.update).not.toHaveBeenCalled();
  });
});
