/**
 * Account lockout module
 * Implements account lockout after failed login attempts
 */

import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

interface LockoutEntry {
  failedAttempts: number;
  lockedUntil: number | null;
  lastAttempt: number;
}

// In-memory storage for lockout tracking
// In production, consider using Redis for distributed deployments
const lockoutStore = new Map<string, LockoutEntry>();

/**
 * Lockout configuration
 */
export const LOCKOUT_CONFIG = {
  /** Maximum failed attempts before lockout */
  maxAttempts: 5,
  /** Lockout duration in milliseconds (15 minutes) */
  lockoutDurationMs: 15 * 60 * 1000,
  /** Time window for counting failed attempts (1 hour) */
  attemptWindowMs: 60 * 60 * 1000,
  /** Progressive lockout - increase duration with repeated lockouts */
  progressiveLockout: true,
  /** Maximum lockout duration (24 hours) */
  maxLockoutDurationMs: 24 * 60 * 60 * 1000,
};

/**
 * Clean up expired entries periodically
 */
const CLEANUP_INTERVAL = 60000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of lockoutStore.entries()) {
      // Remove entries that are no longer locked and have old attempts
      if (!entry.lockedUntil && now - entry.lastAttempt > LOCKOUT_CONFIG.attemptWindowMs) {
        lockoutStore.delete(key);
      }
      // Remove entries where lockout has expired and no recent attempts
      if (entry.lockedUntil && entry.lockedUntil < now && now - entry.lastAttempt > LOCKOUT_CONFIG.attemptWindowMs) {
        lockoutStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

startCleanup();

/**
 * Get the lockout entry for a user
 */
function getEntry(identifier: string): LockoutEntry {
  let entry = lockoutStore.get(identifier);
  
  if (!entry) {
    entry = {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttempt: 0,
    };
    lockoutStore.set(identifier, entry);
  }

  return entry;
}

/**
 * Check if an account is currently locked
 */
export function isAccountLocked(identifier: string): { locked: boolean; remainingMs?: number; unlockTime?: Date } {
  // Check if feature is enabled
  if (!isFeatureEnabled("accountLockout")) {
    return { locked: false };
  }

  const entry = getEntry(identifier);
  const now = Date.now();

  if (entry.lockedUntil && entry.lockedUntil > now) {
    const remainingMs = entry.lockedUntil - now;
    return {
      locked: true,
      remainingMs,
      unlockTime: new Date(entry.lockedUntil),
    };
  }

  return { locked: false };
}

/**
 * Record a failed login attempt
 * Returns the lockout status after recording the attempt
 */
export function recordFailedAttempt(
  identifier: string,
  context?: { ipAddress?: string; userAgent?: string }
): {
  locked: boolean;
  attemptsRemaining: number;
  lockoutDurationMs?: number;
  unlockTime?: Date;
} {
  // Check if feature is enabled
  if (!isFeatureEnabled("accountLockout")) {
    return { locked: false, attemptsRemaining: LOCKOUT_CONFIG.maxAttempts };
  }

  const entry = getEntry(identifier);
  const now = Date.now();

  // Reset attempts if outside the window
  if (now - entry.lastAttempt > LOCKOUT_CONFIG.attemptWindowMs) {
    entry.failedAttempts = 0;
    entry.lockedUntil = null;
  }

  // Increment failed attempts
  entry.failedAttempts++;
  entry.lastAttempt = now;

  logger.securityEvent("Failed login attempt", {
    identifier,
    failedAttempts: entry.failedAttempts,
    maxAttempts: LOCKOUT_CONFIG.maxAttempts,
    ...context,
  });

  // Check if we should lock the account
  if (entry.failedAttempts >= LOCKOUT_CONFIG.maxAttempts) {
    // Calculate lockout duration (progressive if enabled)
    let lockoutDuration = LOCKOUT_CONFIG.lockoutDurationMs;
    
    if (LOCKOUT_CONFIG.progressiveLockout) {
      // Double the lockout duration for each lockout (up to max)
      const lockoutCount = Math.floor(entry.failedAttempts / LOCKOUT_CONFIG.maxAttempts);
      lockoutDuration = Math.min(
        LOCKOUT_CONFIG.lockoutDurationMs * Math.pow(2, lockoutCount - 1),
        LOCKOUT_CONFIG.maxLockoutDurationMs
      );
    }

    entry.lockedUntil = now + lockoutDuration;

    logger.securityEvent("Account locked", {
      identifier,
      lockoutDurationMs: lockoutDuration,
      unlockTime: new Date(entry.lockedUntil).toISOString(),
      failedAttempts: entry.failedAttempts,
      ...context,
    });

    return {
      locked: true,
      attemptsRemaining: 0,
      lockoutDurationMs: lockoutDuration,
      unlockTime: new Date(entry.lockedUntil),
    };
  }

  return {
    locked: false,
    attemptsRemaining: LOCKOUT_CONFIG.maxAttempts - entry.failedAttempts,
  };
}

/**
 * Record a successful login (resets the lockout counter)
 */
export function recordSuccessfulLogin(identifier: string): void {
  const entry = lockoutStore.get(identifier);
  
  if (entry) {
    logger.info("Successful login - resetting lockout counter", {
      identifier,
      previousFailedAttempts: entry.failedAttempts,
    });
    lockoutStore.delete(identifier);
  }
}

/**
 * Manually unlock an account (admin action)
 */
export function unlockAccount(identifier: string, adminId?: string): boolean {
  const entry = lockoutStore.get(identifier);
  
  if (!entry) {
    return false;
  }

  logger.securityEvent("Account manually unlocked", {
    identifier,
    adminId,
    previousFailedAttempts: entry.failedAttempts,
    wasLocked: entry.lockedUntil !== null && entry.lockedUntil > Date.now(),
  });

  lockoutStore.delete(identifier);
  return true;
}

/**
 * Get lockout status for an account (admin view)
 */
export function getLockoutStatus(identifier: string): {
  failedAttempts: number;
  lockedUntil: Date | null;
  lastAttempt: Date | null;
  isLocked: boolean;
} {
  const entry = lockoutStore.get(identifier);
  const now = Date.now();

  if (!entry) {
    return {
      failedAttempts: 0,
      lockedUntil: null,
      lastAttempt: null,
      isLocked: false,
    };
  }

  return {
    failedAttempts: entry.failedAttempts,
    lockedUntil: entry.lockedUntil ? new Date(entry.lockedUntil) : null,
    lastAttempt: entry.lastAttempt ? new Date(entry.lastAttempt) : null,
    isLocked: entry.lockedUntil !== null && entry.lockedUntil > now,
  };
}

/**
 * Get all locked accounts (admin view)
 */
export function getAllLockedAccounts(): Array<{
  identifier: string;
  failedAttempts: number;
  lockedUntil: Date;
  lastAttempt: Date;
}> {
  const now = Date.now();
  const locked: Array<{
    identifier: string;
    failedAttempts: number;
    lockedUntil: Date;
    lastAttempt: Date;
  }> = [];

  for (const [identifier, entry] of lockoutStore.entries()) {
    if (entry.lockedUntil && entry.lockedUntil > now) {
      locked.push({
        identifier,
        failedAttempts: entry.failedAttempts,
        lockedUntil: new Date(entry.lockedUntil),
        lastAttempt: new Date(entry.lastAttempt),
      });
    }
  }

  return locked;
}

/**
 * Format lockout message for user display
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
