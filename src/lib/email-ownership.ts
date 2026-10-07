import prisma from "./prisma";
import { AppError, ForbiddenError } from "./errors";
import { getSuperAdminEmails } from "./super-admin";

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
 *   platform rights.
 * - EmailConflictError when another user already holds the address, compared
 *   case-insensitively (the database unique index is case-sensitive).
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
    throw new ForbiddenError(
      "not_super_admin",
      "This email address is reserved",
    );
  }

  const existing = await prisma.user.findFirst({
    where: {
      email: { equals: normalized, mode: "insensitive" },
      ...(opts.excludeUserId ? { NOT: { userid: opts.excludeUserId } } : {}),
    },
    select: { userid: true },
  });
  if (existing) {
    throw new EmailConflictError();
  }

  return normalized;
}
