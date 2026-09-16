/**
 * Audit trail for BetterAuth's two-factor endpoints.
 *
 * Enrolment, removal and backup-code regeneration are recorded as USER updates;
 * a login completed with a TOTP or backup code is recorded as a LOGIN, mirroring
 * the credentials login audit in `auth-server.ts`.
 */

import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

export interface TwoFactorCall {
  path: string;
  /** The endpoint threw; nothing happened, nothing to audit. */
  failed: boolean;
  /** A session cookie accompanied the request: enrolment or management, not a login. */
  hadSession: boolean;
  userId: string | null;
}

export type TwoFactorEvent =
  | {
      kind: "enabled" | "disabled" | "backup_codes_regenerated";
      userId: string;
    }
  | { kind: "login"; userId: string; method: "totp" | "backup_code" };

const LOGIN_METHODS: Record<string, "totp" | "backup_code"> = {
  "/two-factor/verify-totp": "totp",
  "/two-factor/verify-backup-code": "backup_code",
};

const UPDATE_REASONS: Record<
  Exclude<TwoFactorEvent["kind"], "login">,
  string
> = {
  enabled: "MFA enabled",
  disabled: "MFA disabled",
  backup_codes_regenerated: "MFA backup codes regenerated",
};

export function classifyTwoFactorCall(
  call: TwoFactorCall,
): TwoFactorEvent | null {
  if (call.failed || !call.userId) return null;
  const { path, userId } = call;
  if (path === "/two-factor/disable") return { kind: "disabled", userId };
  if (path === "/two-factor/generate-backup-codes") {
    return { kind: "backup_codes_regenerated", userId };
  }
  const method = LOGIN_METHODS[path];
  if (!method) return null;
  // verify-totp doubles as the enrolment confirmation when called with a session.
  if (call.hadSession)
    return method === "totp" ? { kind: "enabled", userId } : null;
  return { kind: "login", userId, method };
}

export async function auditTwoFactorEvent(
  event: TwoFactorEvent,
): Promise<void> {
  if (event.kind === "login") {
    await createAuditLog({
      userId: event.userId,
      action: AUDIT_ACTIONS.LOGIN,
      entity: AUDIT_ENTITIES.USER,
      entityId: event.userId,
      details: { method: event.method },
    });
    return;
  }
  await createAuditLog({
    userId: event.userId,
    action: AUDIT_ACTIONS.UPDATE,
    entity: AUDIT_ENTITIES.USER,
    entityId: event.userId,
    details: { reason: UPDATE_REASONS[event.kind] },
  });
}
