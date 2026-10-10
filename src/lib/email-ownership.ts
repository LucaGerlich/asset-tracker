import { AppError, ForbiddenError } from "./errors";
import { getSuperAdminEmails } from "./super-admin";
import { countUsersByEmail, userHoldsEmail } from "./user-email-query";

/** 409 — another user already holds this email address. */
export class EmailConflictError extends AppError {
  constructor() {
    super("Email is already in use", 409);
  }
}

/** Canonical stored form of an email address. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Guard every write of `user.email`. Returns the normalised address to store,
 * or throws:
 *
 * - ForbiddenError("not_super_admin") when the address is listed in
 *   SUPER_ADMIN_EMAILS and the caller is not a super-admin. Without this, a
 *   tenant admin could rename a user to a super-admin address and inherit the
 *   platform rights. The one exception is an unchanged address: when
 *   `excludeUserId` already holds the reserved address, keeping it is allowed,
 *   so directory syncs and admin edits of the real super-admin account work.
 * - EmailConflictError when another user already holds the address, compared
 *   case-insensitively (the database unique index is case-sensitive) and
 *   exactly: `_` and `%` in the address are never wildcards.
 *
 * Pass `excludeUserId` when updating an existing user so their own current
 * address does not count as a conflict.
 */
export async function assertEmailAssignable(
  email: string,
  opts: { excludeUserId?: string; callerIsSuperAdmin: boolean },
): Promise<string> {
  const normalized = normalizeEmail(email);

  if (!opts.callerIsSuperAdmin && getSuperAdminEmails().includes(normalized)) {
    const alreadyHeld = opts.excludeUserId
      ? await userHoldsEmail(opts.excludeUserId, normalized)
      : false;
    if (!alreadyHeld) {
      throw new ForbiddenError(
        "not_super_admin",
        "This email address is reserved",
      );
    }
  }

  if ((await countUsersByEmail(normalized, opts.excludeUserId)) > 0) {
    throw new EmailConflictError();
  }

  return normalized;
}
