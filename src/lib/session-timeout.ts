/**
 * Session timeout management
 * Tracks user activity and handles session expiration for inactivity
 */

import { logger } from "@/lib/logger";
import { isFeatureEnabled } from "@/lib/feature-flags";

/**
 * Session timeout configuration
 */
export const SESSION_TIMEOUT_CONFIG = {
  /** Inactivity timeout in milliseconds (30 minutes) */
  inactivityTimeoutMs: 30 * 60 * 1000,
  /** Warning before timeout in milliseconds (5 minutes) */
  warningBeforeTimeoutMs: 5 * 60 * 1000,
  /** Check interval in milliseconds (1 minute) */
  checkIntervalMs: 60 * 1000,
  /** Absolute session timeout (24 hours) - session expires regardless of activity */
  absoluteTimeoutMs: 24 * 60 * 60 * 1000,
};

// In-memory storage for activity tracking
// In production with multiple instances, use Redis or database
const activityStore = new Map<string, { lastActivity: number; sessionStart: number }>();

/**
 * Record user activity (call this on each authenticated request)
 */
export function recordActivity(sessionId: string): void {
  if (!isFeatureEnabled("sessionTimeout")) {
    return;
  }

  const now = Date.now();
  const existing = activityStore.get(sessionId);

  if (existing) {
    existing.lastActivity = now;
  } else {
    activityStore.set(sessionId, {
      lastActivity: now,
      sessionStart: now,
    });
  }
}

/**
 * Check if a session has timed out
 */
export function isSessionTimedOut(sessionId: string): {
  timedOut: boolean;
  reason?: "inactivity" | "absolute";
  lastActivity?: Date;
  sessionAge?: number;
} {
  if (!isFeatureEnabled("sessionTimeout")) {
    return { timedOut: false };
  }

  const entry = activityStore.get(sessionId);
  const now = Date.now();

  if (!entry) {
    // No activity recorded - consider as new session
    return { timedOut: false };
  }

  // Check absolute timeout first
  const sessionAge = now - entry.sessionStart;
  if (sessionAge > SESSION_TIMEOUT_CONFIG.absoluteTimeoutMs) {
    logger.info("Session expired due to absolute timeout", {
      sessionId,
      sessionAgeMs: sessionAge,
    });
    activityStore.delete(sessionId);
    return {
      timedOut: true,
      reason: "absolute",
      lastActivity: new Date(entry.lastActivity),
      sessionAge,
    };
  }

  // Check inactivity timeout
  const inactiveTime = now - entry.lastActivity;
  if (inactiveTime > SESSION_TIMEOUT_CONFIG.inactivityTimeoutMs) {
    logger.info("Session expired due to inactivity", {
      sessionId,
      inactiveTimeMs: inactiveTime,
    });
    activityStore.delete(sessionId);
    return {
      timedOut: true,
      reason: "inactivity",
      lastActivity: new Date(entry.lastActivity),
      sessionAge,
    };
  }

  return { timedOut: false };
}

/**
 * Check if session is about to expire (for warning)
 */
export function isSessionAboutToExpire(sessionId: string): {
  expiring: boolean;
  remainingMs?: number;
  reason?: "inactivity" | "absolute";
} {
  if (!isFeatureEnabled("sessionTimeout")) {
    return { expiring: false };
  }

  const entry = activityStore.get(sessionId);
  const now = Date.now();

  if (!entry) {
    return { expiring: false };
  }

  // Check absolute timeout warning
  const sessionAge = now - entry.sessionStart;
  const absoluteRemaining = SESSION_TIMEOUT_CONFIG.absoluteTimeoutMs - sessionAge;
  if (absoluteRemaining <= SESSION_TIMEOUT_CONFIG.warningBeforeTimeoutMs && absoluteRemaining > 0) {
    return {
      expiring: true,
      remainingMs: absoluteRemaining,
      reason: "absolute",
    };
  }

  // Check inactivity timeout warning
  const inactiveTime = now - entry.lastActivity;
  const inactivityRemaining = SESSION_TIMEOUT_CONFIG.inactivityTimeoutMs - inactiveTime;
  if (inactivityRemaining <= SESSION_TIMEOUT_CONFIG.warningBeforeTimeoutMs && inactivityRemaining > 0) {
    return {
      expiring: true,
      remainingMs: inactivityRemaining,
      reason: "inactivity",
    };
  }

  return { expiring: false };
}

/**
 * Extend session (reset inactivity timer)
 */
export function extendSession(sessionId: string): boolean {
  const entry = activityStore.get(sessionId);
  
  if (!entry) {
    return false;
  }

  entry.lastActivity = Date.now();
  logger.info("Session extended", { sessionId });
  return true;
}

/**
 * Invalidate a session
 */
export function invalidateSession(sessionId: string): void {
  activityStore.delete(sessionId);
  logger.info("Session invalidated", { sessionId });
}

/**
 * Get session status
 */
export function getSessionStatus(sessionId: string): {
  active: boolean;
  lastActivity?: Date;
  sessionStart?: Date;
  inactiveMs?: number;
  sessionAgeMs?: number;
  expiresIn?: number;
} {
  const entry = activityStore.get(sessionId);
  const now = Date.now();

  if (!entry) {
    return { active: false };
  }

  const inactiveMs = now - entry.lastActivity;
  const sessionAgeMs = now - entry.sessionStart;
  
  // Calculate when session will expire (whichever comes first)
  const inactivityExpiry = SESSION_TIMEOUT_CONFIG.inactivityTimeoutMs - inactiveMs;
  const absoluteExpiry = SESSION_TIMEOUT_CONFIG.absoluteTimeoutMs - sessionAgeMs;
  const expiresIn = Math.min(inactivityExpiry, absoluteExpiry);

  return {
    active: true,
    lastActivity: new Date(entry.lastActivity),
    sessionStart: new Date(entry.sessionStart),
    inactiveMs,
    sessionAgeMs,
    expiresIn: Math.max(0, expiresIn),
  };
}

/**
 * Clean up expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [sessionId, entry] of activityStore.entries()) {
    const sessionAge = now - entry.sessionStart;
    const inactiveTime = now - entry.lastActivity;

    if (
      sessionAge > SESSION_TIMEOUT_CONFIG.absoluteTimeoutMs ||
      inactiveTime > SESSION_TIMEOUT_CONFIG.inactivityTimeoutMs
    ) {
      activityStore.delete(sessionId);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info("Cleaned up expired sessions", { count: cleaned });
  }

  return cleaned;
}

// Start periodic cleanup
const cleanupTimer = setInterval(cleanupExpiredSessions, SESSION_TIMEOUT_CONFIG.checkIntervalMs);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

/**
 * Format remaining time for display
 */
export function formatRemainingTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  }
  return `${seconds} seconds`;
}

/**
 * Get a human-readable session timeout message
 */
export function getTimeoutMessage(reason: "inactivity" | "absolute"): string {
  if (reason === "inactivity") {
    return "Your session has expired due to inactivity. Please log in again.";
  }
  return "Your session has expired. Please log in again.";
}
