import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: { LOGIN: "login", UPDATE: "update" },
  AUDIT_ENTITIES: { USER: "user" },
}));

import { createAuditLog } from "@/lib/audit-log";
import {
  classifyTwoFactorCall,
  auditTwoFactorEvent,
} from "@/lib/auth-two-factor-audit";

const call = (
  overrides: Partial<Parameters<typeof classifyTwoFactorCall>[0]>,
) => ({
  path: "/two-factor/verify-totp",
  failed: false,
  hadSession: false,
  userId: "user-1",
  ...overrides,
});

describe("classifyTwoFactorCall", () => {
  it("ignores failed calls and calls without a user", () => {
    expect(classifyTwoFactorCall(call({ failed: true }))).toBeNull();
    expect(classifyTwoFactorCall(call({ userId: null }))).toBeNull();
  });

  it("treats verify-totp with a session as enrolment, without as login", () => {
    expect(classifyTwoFactorCall(call({ hadSession: true }))).toEqual({
      kind: "enabled",
      userId: "user-1",
    });
    expect(classifyTwoFactorCall(call({}))).toEqual({
      kind: "login",
      userId: "user-1",
      method: "totp",
    });
  });

  it("classifies backup-code logins, disable and regeneration", () => {
    expect(
      classifyTwoFactorCall(call({ path: "/two-factor/verify-backup-code" })),
    ).toEqual({ kind: "login", userId: "user-1", method: "backup_code" });
    expect(
      classifyTwoFactorCall(
        call({ path: "/two-factor/disable", hadSession: true }),
      ),
    ).toEqual({
      kind: "disabled",
      userId: "user-1",
    });
    expect(
      classifyTwoFactorCall(
        call({ path: "/two-factor/generate-backup-codes", hadSession: true }),
      ),
    ).toEqual({ kind: "backup_codes_regenerated", userId: "user-1" });
  });

  it("ignores unrelated two-factor endpoints", () => {
    expect(
      classifyTwoFactorCall(
        call({ path: "/two-factor/enable", hadSession: true }),
      ),
    ).toBeNull();
    expect(
      classifyTwoFactorCall(
        call({ path: "/two-factor/get-totp-uri", hadSession: true }),
      ),
    ).toBeNull();
  });
});

describe("auditTwoFactorEvent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records logins with the method used", async () => {
    await auditTwoFactorEvent({
      kind: "login",
      userId: "user-1",
      method: "totp",
    });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        action: "login",
        details: { method: "totp" },
      }),
    );
  });

  it("records enrolment changes as user updates with a reason", async () => {
    await auditTwoFactorEvent({ kind: "disabled", userId: "user-1" });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "update",
        entityId: "user-1",
        details: { reason: "MFA disabled" },
      }),
    );
  });
});
