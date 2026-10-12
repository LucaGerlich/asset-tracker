import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest } from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

import { GET, DELETE } from "@/app/api/admin/rate-limits/route";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

const mockPrisma = vi.mocked(prisma, true);

const del = (body: Record<string, unknown>) =>
  DELETE(
    createMockRequest("/api/admin/rate-limits", { method: "DELETE", body }),
  );

/** An org admin: passes requireApiAdmin, fails requireSuperAdmin. */
function actAsOrgAdmin() {
  vi.mocked(requireSuperAdmin).mockRejectedValue(
    new ForbiddenError("not_super_admin", "Super-admin access required"),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({
    id: "super-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
    orgStatus: "active" as const,
  } as never);
  vi.mocked(requireWritableOrg).mockResolvedValue(undefined);
});

describe("GET /api/admin/rate-limits", () => {
  it("answers 403 for an org admin and reads no rows", async () => {
    actAsOrgAdmin();

    const res = await GET();

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_super_admin" });
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("is guarded by requireSuperAdmin, not by the per-org admin check", async () => {
    await GET();

    expect(requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(requireApiAdmin).not.toHaveBeenCalled();
  });

  it("answers 401 for an unauthenticated caller", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(new UnauthorizedError());

    const res = await GET();

    expect(res.status).toBe(401);
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it("lists the platform's rate limit entries for a super-admin", async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([
      { key: "login:1.2.3.4", count: 4, reset_at: new Date("2999-01-01") },
    ] as never);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ total: 1, activeCount: 1 });
    expect(body.entries[0]).toMatchObject({ key: "login:1.2.3.4", count: 4 });
  });
});

describe("DELETE /api/admin/rate-limits", () => {
  it("answers 403 for an org admin and deletes nothing", async () => {
    actAsOrgAdmin();

    const res = await del({ key: "login:1.2.3.4" });

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ code: "not_super_admin" });
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("is guarded by requireSuperAdmin, not by the per-org admin check", async () => {
    await del({ key: "login:1.2.3.4" });

    expect(requireSuperAdmin).toHaveBeenCalledTimes(1);
    expect(requireApiAdmin).not.toHaveBeenCalled();
  });

  it("answers 403 and deletes nothing when the org is read-only", async () => {
    vi.mocked(requireWritableOrg).mockRejectedValue(
      new ForbiddenError("org_read_only", "Organization is in read-only mode"),
    );

    const res = await del({ key: "login:1.2.3.4" });

    expect(res.status).toBe(403);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("answers 400 without a key", async () => {
    const res = await del({});

    expect(res.status).toBe(400);
    expect(mockPrisma.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it("resets one key with a bound parameter for a super-admin", async () => {
    const res = await del({ key: "login:1.2.3.4" });

    expect(res.status).toBe(200);
    expect(mockPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, key] = mockPrisma.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain(`WHERE "key" = $1`);
    expect(key).toBe("login:1.2.3.4");
  });
});
