import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/gdpr-settings", () => ({
  getGDPRSettings: vi.fn(),
  saveGDPRSettings: vi.fn(),
}));

import { GET, PUT } from "@/app/api/admin/gdpr/retention/route";
import {
  requireApiAdmin,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { getGDPRSettings, saveGDPRSettings } from "@/lib/gdpr-settings";
import { ForbiddenError } from "@/lib/errors";

const settings = {
  auditLogRetentionDays: 365,
  deletedUserRetentionDays: 90,
  exportRetentionDays: 30,
  updatedAt: null,
};

const put = (body: Record<string, unknown>) =>
  PUT(createMockRequest("/api/admin/gdpr/retention", { method: "PUT", body }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireSuperAdmin).mockResolvedValue({
    id: "admin-uuid-001",
    isAdmin: true,
    organizationId: "org-uuid-001",
    orgStatus: "active",
  });
  vi.mocked(getGDPRSettings).mockReturnValue(settings);
  vi.mocked(saveGDPRSettings).mockReturnValue({
    ...settings,
    auditLogRetentionDays: 30,
  });
});

describe("PUT /api/admin/gdpr/retention", () => {
  // The settings file is shared by the whole deployment and the retention cron
  // applies it to every organization's audit logs.
  it("answers 403 and saves nothing for an organization admin", async () => {
    vi.mocked(requireSuperAdmin).mockRejectedValue(
      new ForbiddenError("not_super_admin", "Super-admin access required"),
    );

    const { status, body } = await parseResponse<{ code: string }>(
      await put({ ...settings, auditLogRetentionDays: 1 }),
    );

    expect(status).toBe(403);
    expect(body.code).toBe("not_super_admin");
    expect(saveGDPRSettings).not.toHaveBeenCalled();
  });

  it("saves the settings for a super-admin", async () => {
    const res = await put({ ...settings, auditLogRetentionDays: 30 });

    expect(res.status).toBe(200);
    expect(requireSuperAdmin).toHaveBeenCalled();
    expect(requireWritableOrg).toHaveBeenCalled();
    expect(saveGDPRSettings).toHaveBeenCalledWith({
      auditLogRetentionDays: 30,
      deletedUserRetentionDays: 90,
      exportRetentionDays: 30,
    });
  });

  it("still rejects invalid values", async () => {
    const res = await put({ ...settings, auditLogRetentionDays: 0 });

    expect(res.status).toBe(400);
    expect(saveGDPRSettings).not.toHaveBeenCalled();
  });
});

describe("GET /api/admin/gdpr/retention", () => {
  it("stays readable by organization admins", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(requireApiAdmin).toHaveBeenCalled();
    expect(requireSuperAdmin).not.toHaveBeenCalled();
  });
});
