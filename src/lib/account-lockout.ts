import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

const S = process.env.DB_SCHEMA || "assettool";
if (!/^[a-zA-Z0-9_]+$/.test(S)) {
  throw new Error(
    `Invalid DB_SCHEMA: "${S}". Only alphanumeric and underscores allowed.`,
  );
}
const LOCKOUT_TABLE = `"${S}"."account_lockouts"`;

let tableChecked = false;
let _ensurePromise: Promise<void> | null = null;

async function ensureLockoutTable(): Promise<void> {
  if (tableChecked) return;
  if (_ensurePromise) return _ensurePromise;

  _ensurePromise = (async () => {
    try {
      await prisma.$executeRawUnsafe(`
				CREATE UNLOGGED TABLE IF NOT EXISTS ${LOCKOUT_TABLE} (
					"key"             VARCHAR(255) PRIMARY KEY,
					"failed_attempts" INTEGER NOT NULL DEFAULT 0,
					"locked_until"    TIMESTAMPTZ,
					"last_attempt"    TIMESTAMPTZ NOT NULL DEFAULT NOW()
				)
			`);
      tableChecked = true;
    } catch (e) {
      logger.error("[account-lockout] ensureLockoutTable failed", {
        error: e,
      });
    } finally {
      _ensurePromise = null;
    }
  })();
  return _ensurePromise;
}

export const LOCKOUT_CONFIG = {
  /** Maximum failed attempts before lockout */
  maxAttempts: 5,
  /** Lockout duration in milliseconds (15 minutes) */
  lockoutDurationMs: 15 * 60 * 1000,
  /** Time window for counting failed attempts (1 hour) */
  attemptWindowMs: 60 * 60 * 1000,
  /** Progressive lockout — increase duration with repeated lockouts */
  progressiveLockout: true,
  /** Maximum lockout duration (24 hours) */
  maxLockoutDurationMs: 24 * 60 * 60 * 1000,
};

interface LockoutRow {
  failed_attempts: number;
  locked_until: Date | null;
  last_attempt: Date;
}

/**
 * Check if an account is currently locked.
 */
export async function isAccountLocked(
  identifier: string,
): Promise<{ locked: boolean; remainingMs?: number; unlockTime?: Date }> {
  if (!isFeatureEnabled("accountLockout")) {
    return { locked: false };
  }

  try {
    await ensureLockoutTable();

    const rows = await prisma.$queryRawUnsafe<LockoutRow[]>(
      `SELECT "failed_attempts", "locked_until", "last_attempt"
			 FROM ${LOCKOUT_TABLE}
			 WHERE "key" = $1`,
      identifier,
    );

    if (rows.length === 0) return { locked: false };

    const row = rows[0];
    if (row.locked_until && new Date(row.locked_until) > new Date()) {
      const remainingMs = new Date(row.locked_until).getTime() - Date.now();
      return {
        locked: true,
        remainingMs,
        unlockTime: new Date(row.locked_until),
      };
    }

    return { locked: false };
  } catch (e) {
    logger.error("[account-lockout] isAccountLocked failed", { error: e });
    // Fail open — don't block logins if DB is down
    return { locked: false };
  }
}

/**
 * Record a failed login attempt.
 * Returns the lockout status after recording the attempt.
 */
export async function recordFailedAttempt(
  identifier: string,
  context?: { ipAddress?: string; userAgent?: string },
): Promise<{
  locked: boolean;
  attemptsRemaining: number;
  lockoutDurationMs?: number;
  unlockTime?: Date;
}> {
  if (!isFeatureEnabled("accountLockout")) {
    return { locked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts };
  }

  try {
    await ensureLockoutTable();

    const windowSeconds = LOCKOUT_CONFIG.attemptWindowMs / 1000;

    // Atomic upsert: insert or increment failed_attempts.
    // If last_attempt is older than the window, reset the counter.
    const rows = await prisma.$queryRawUnsafe<LockoutRow[]>(
      `INSERT INTO ${LOCKOUT_TABLE} ("key", "failed_attempts", "last_attempt")
			 VALUES ($1, 1, NOW())
			 ON CONFLICT ("key") DO UPDATE
			   SET "failed_attempts" = CASE
			                             WHEN ${LOCKOUT_TABLE}."last_attempt" < NOW() - make_interval(secs => $2)
			                               THEN 1
			                             ELSE ${LOCKOUT_TABLE}."failed_attempts" + 1
			                           END,
			       "last_attempt" = NOW(),
			       "locked_until" = CASE
			                          WHEN ${LOCKOUT_TABLE}."locked_until" IS NOT NULL
			                               AND ${LOCKOUT_TABLE}."locked_until" > NOW()
			                            THEN ${LOCKOUT_TABLE}."locked_until"
			                          ELSE NULL
			                        END
			 RETURNING "failed_attempts", "locked_until", "last_attempt"`,
      identifier,
      windowSeconds,
    );

    const row = rows[0];

    logger.securityEvent("Failed login attempt", {
      identifier,
      failedAttempts: row.failed_attempts,
      maxAttempts: LOCKOUT_CONFIG.maxAttempts,
      ...context,
    });

    if (row.failed_attempts >= LOCKOUT_CONFIG.maxAttempts) {
      // Calculate progressive lockout duration
      const lockoutCount = Math.floor(
        row.failed_attempts / LOCKOUT_CONFIG.maxAttempts,
      );
      const lockoutDuration = LOCKOUT_CONFIG.progressiveLockout
        ? Math.min(
            LOCKOUT_CONFIG.lockoutDurationMs * Math.pow(2, lockoutCount - 1),
            LOCKOUT_CONFIG.maxLockoutDurationMs,
          )
        : LOCKOUT_CONFIG.lockoutDurationMs;

      const lockoutSeconds = lockoutDuration / 1000;

      // Set the locked_until timestamp
      await prisma.$executeRawUnsafe(
        `UPDATE ${LOCKOUT_TABLE}
				 SET "locked_until" = NOW() + make_interval(secs => $2)
				 WHERE "key" = $1`,
        identifier,
        lockoutSeconds,
      );

      const unlockTime = new Date(Date.now() + lockoutDuration);

      logger.securityEvent("Account locked", {
        identifier,
        lockoutDurationMs: lockoutDuration,
        unlockTime: unlockTime.toISOString(),
        failedAttempts: row.failed_attempts,
        ...context,
      });

      return {
        locked: true,
        attemptsRemaining: 0,
        lockoutDurationMs: lockoutDuration,
        unlockTime,
      };
    }

    return {
      locked: false,
      attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - row.failed_attempts,
    };
  } catch (e) {
    logger.error("[account-lockout] recordFailedAttempt failed", {
      error: e,
    });
    return {
      locked: false,
      attemptsRemaining: LOCKOUT_CONFIG.maxAttempts,
    };
  }
}

/**
 * Record a successful login (resets the lockout counter).
 */
export async function recordSuccessfulLogin(identifier: string): Promise<void> {
  try {
    await ensureLockoutTable();
    await prisma.$executeRawUnsafe(
      `DELETE FROM ${LOCKOUT_TABLE} WHERE "key" = $1`,
      identifier,
    );
  } catch (e) {
    logger.error("[account-lockout] recordSuccessfulLogin failed", {
      error: e,
    });
  }
}

/**
 * Manually unlock an account (admin action).
 */
export async function unlockAccount(
  identifier: string,
  adminId?: string,
): Promise<boolean> {
  try {
    await ensureLockoutTable();

    const rows = await prisma.$queryRawUnsafe<LockoutRow[]>(
      `DELETE FROM ${LOCKOUT_TABLE} WHERE "key" = $1
			 RETURNING "failed_attempts", "locked_until", "last_attempt"`,
      identifier,
    );

    if (rows.length === 0) return false;

    logger.securityEvent("Account manually unlocked", {
      identifier,
      adminId,
      previousFailedAttempts: rows[0].failed_attempts,
      wasLocked:
        rows[0].locked_until !== null &&
        new Date(rows[0].locked_until) > new Date(),
    });

    return true;
  } catch (e) {
    logger.error("[account-lockout] unlockAccount failed", { error: e });
    return false;
  }
}

/**
 * Get lockout status for an account (admin view).
 */
export async function getLockoutStatus(identifier: string): Promise<{
  failedAttempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date | null;
  isLocked: boolean;
}> {
  try {
    await ensureLockoutTable();

    const rows = await prisma.$queryRawUnsafe<LockoutRow[]>(
      `SELECT "failed_attempts", "locked_until", "last_attempt"
			 FROM ${LOCKOUT_TABLE}
			 WHERE "key" = $1`,
      identifier,
    );

    if (rows.length === 0) {
      return {
        failedAttempts: 0,
        lockedUntil: null,
        lastAttempt: null,
        isLocked: false,
      };
    }

    const row = rows[0];
    return {
      failedAttempts: row.failed_attempts,
      lockedUntil: row.locked_until ? new Date(row.locked_until) : null,
      lastAttempt: new Date(row.last_attempt),
      isLocked:
        row.locked_until !== null && new Date(row.locked_until) > new Date(),
    };
  } catch (e) {
    logger.error("[account-lockout] getLockoutStatus failed", { error: e });
    return {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttempt: null,
      isLocked: false,
    };
  }
}

/**
 * Get all currently locked accounts (admin view).
 */
export async function getAllLockedAccounts(): Promise<
  Array<{
    identifier: string;
    failedAttempts: number;
    lockedUntil: Date;
    lastAttempt: Date;
  }>
> {
  try {
    await ensureLockoutTable();

    const rows = await prisma.$queryRawUnsafe<
      Array<{
        key: string;
        failed_attempts: number;
        locked_until: Date;
        last_attempt: Date;
      }>
    >(
      `SELECT "key", "failed_attempts", "locked_until", "last_attempt"
			 FROM ${LOCKOUT_TABLE}
			 WHERE "locked_until" IS NOT NULL AND "locked_until" > NOW()`,
    );

    return rows.map((r) => ({
      identifier: r.key,
      failedAttempts: r.failed_attempts,
      lockedUntil: new Date(r.locked_until),
      lastAttempt: new Date(r.last_attempt),
    }));
  } catch (e) {
    logger.error("[account-lockout] getAllLockedAccounts failed", {
      error: e,
    });
    return [];
  }
}

/**
 * Format lockout message for user display.
 */
export function formatLockoutMessage(remainingMs: number): string {
  const minutes = Math.ceil(remainingMs / (60 * 1000));

  if (minutes <= 1) {
    return "Your account is temporarily locked. Please try again in about a minute.";
  }

  if (minutes < 60) {
    return `Your account is temporarily locked. Please try again in ${minutes} minutes.`;
  }

  const hours = Math.ceil(minutes / 60);
  if (hours === 1) {
    return "Your account is temporarily locked. Please try again in about an hour.";
  }

  return `Your account is temporarily locked. Please try again in ${hours} hours.`;
}
