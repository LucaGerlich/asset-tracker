/**
 * Suspicious login activity detection
 *
 * Tracks login metadata per user (IP, user agent, timestamp) in memory
 * and detects patterns that may indicate account compromise or abuse:
 *
 * - New IP: login from an IP not seen in the last 30 days
 * - Impossible travel: login from a different IP within 60 minutes
 * - Brute force: >10 failed attempts from the same IP in 15 minutes
 */

import { logger } from "@/lib/logger";

// --- Types ---

interface LoginRecord {
  ip: string;
  userAgent: string;
  timestamp: number;
  success: boolean;
}

interface UserLoginHistory {
  /** Known IPs mapped to last-seen timestamp */
  knownIps: Map<string, number>;
  /** Recent logins (successful) for impossible-travel detection */
  recentLogins: LoginRecord[];
}

export interface SuspiciousActivityResult {
  suspicious: boolean;
  reasons: string[];
}

// --- Constants ---

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SIXTY_MINUTES_MS = 60 * 60 * 1000;
const FIFTEEN_MINUTES_MS = 15 * 60 * 1000;
const BRUTE_FORCE_THRESHOLD = 10;

// --- In-memory stores ---

/** Per-user login history keyed by userId */
const userHistory: Map<string, UserLoginHistory> = new Map();

/** Failed login attempts keyed by IP address: array of timestamps */
const failedAttemptsByIp: Map<string, number[]> = new Map();

// --- Cleanup helpers ---

/**
 * Remove stale entries from a user's known IPs (older than 30 days)
 * and trim recent logins to last 60 minutes.
 */
function cleanupUserHistory(history: UserLoginHistory, now: number): void {
  // Prune known IPs older than 30 days
  for (const [ip, lastSeen] of history.knownIps) {
    if (now - lastSeen > THIRTY_DAYS_MS) {
      history.knownIps.delete(ip);
    }
  }

  // Keep only recent logins within the last 60 minutes
  history.recentLogins = history.recentLogins.filter(
    (r) => now - r.timestamp <= SIXTY_MINUTES_MS,
  );
}

/**
 * Remove stale failed-attempt entries for an IP (older than 15 minutes).
 */
function cleanupFailedAttempts(ip: string, now: number): void {
  const attempts = failedAttemptsByIp.get(ip);
  if (!attempts) return;

  const recent = attempts.filter((t) => now - t <= FIFTEEN_MINUTES_MS);
  if (recent.length === 0) {
    failedAttemptsByIp.delete(ip);
  } else {
    failedAttemptsByIp.set(ip, recent);
  }
}

// --- Public API ---

/**
 * Record a login attempt (successful or failed).
 * Call this after every sign-in attempt.
 */
export function recordLoginAttempt(
  userId: string | null,
  ip: string,
  userAgent: string,
  success: boolean,
): void {
  const now = Date.now();

  if (!success) {
    // Track failed attempts by IP regardless of user
    const attempts = failedAttemptsByIp.get(ip) || [];
    attempts.push(now);
    failedAttemptsByIp.set(ip, attempts);
    return;
  }

  // Successful login — update user history
  if (!userId) return;

  let history = userHistory.get(userId);
  if (!history) {
    history = { knownIps: new Map(), recentLogins: [] };
    userHistory.set(userId, history);
  }

  // Cleanup before recording
  cleanupUserHistory(history, now);
  cleanupFailedAttempts(ip, now);

  // Record the IP as known and add to recent logins
  history.knownIps.set(ip, now);
  history.recentLogins.push({ ip, userAgent, timestamp: now, success: true });
}

/**
 * Check whether the current login shows suspicious patterns.
 * Call this after a successful sign-in with the user's info.
 */
export function checkSuspiciousActivity(
  userId: string,
  ip: string,
  _userAgent: string,
): SuspiciousActivityResult {
  const now = Date.now();
  const reasons: string[] = [];

  // --- 1. Brute force detection (IP-based, checked even before user history) ---
  cleanupFailedAttempts(ip, now);
  const failedCount = failedAttemptsByIp.get(ip)?.length ?? 0;
  if (failedCount >= BRUTE_FORCE_THRESHOLD) {
    reasons.push(
      `Brute force: ${failedCount} failed login attempts from IP ${ip} in the last 15 minutes`,
    );
  }

  // --- 2. User-specific checks ---
  const history = userHistory.get(userId);
  if (!history) {
    // First login ever recorded for this user — nothing to compare against
    return { suspicious: reasons.length > 0, reasons };
  }

  cleanupUserHistory(history, now);

  // New IP detection: IP not in known IPs *before* this login was recorded
  // Since recordLoginAttempt may already have added the IP, check if it was
  // seen only once (the current login) by looking at the timestamp.
  const lastSeenAtIp = history.knownIps.get(ip);
  const isNewIp =
    !lastSeenAtIp ||
    (lastSeenAtIp === now &&
      !history.recentLogins.some((r) => r.ip === ip && r.timestamp !== now));

  // Only flag new IP if the user has existing history
  if (isNewIp && history.knownIps.size > 1) {
    reasons.push(
      `New IP address: ${ip} not seen for this user in the last 30 days`,
    );
  }

  // --- 3. Impossible travel detection ---
  // Check if there's a successful login from a *different* IP within 60 minutes
  const recentFromOtherIp = history.recentLogins.find(
    (r) => r.ip !== ip && r.success && now - r.timestamp <= SIXTY_MINUTES_MS,
  );

  if (recentFromOtherIp) {
    const minutesAgo = Math.round((now - recentFromOtherIp.timestamp) / 60_000);
    reasons.push(
      `Impossible travel: login from ${ip} within ${minutesAgo} minute(s) of login from ${recentFromOtherIp.ip}`,
    );
  }

  return { suspicious: reasons.length > 0, reasons };
}

/**
 * Clear all in-memory data. Useful for testing.
 */
export function clearSuspiciousActivityData(): void {
  userHistory.clear();
  failedAttemptsByIp.clear();
}

/**
 * Log suspicious activity findings via the security logger.
 */
export function logSuspiciousActivity(
  userId: string,
  ip: string,
  userAgent: string,
  result: SuspiciousActivityResult,
): void {
  if (!result.suspicious) return;

  for (const reason of result.reasons) {
    logger.securityEvent("Suspicious login activity detected", {
      userId,
      ip,
      userAgent,
      reason,
    });
  }
}
