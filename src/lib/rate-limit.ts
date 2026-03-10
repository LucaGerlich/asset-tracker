/**
 * PostgreSQL-backed rate limiter.
 *
 * Uses the "rate_limits" table for distributed, atomic rate limiting that works
 * correctly in serverless environments (Vercel) where each invocation has its
 * own memory. All state is persisted in PostgreSQL via Prisma raw queries.
 */

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

export interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom message when rate limit is exceeded */
  message?: string;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}

/**
 * Check if a request should be rate limited.
 *
 * Uses an atomic INSERT ... ON CONFLICT to either create a new rate-limit
 * entry or increment an existing one. Expired rows are treated as new windows.
 */
export async function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const windowSeconds = config.windowMs / 1000;

  try {
    // Atomic upsert: if the row doesn't exist or has expired, (re-)create it
    // with count=1; otherwise increment count. Returns the resulting row.
    const rows = await prisma.$queryRawUnsafe<
      Array<{ count: number; reset_at: Date }>
    >(
      `INSERT INTO "rate_limits" ("key", "count", "reset_at")
       VALUES ($1, 1, NOW() + make_interval(secs => $2))
       ON CONFLICT ("key") DO UPDATE
         SET "count"    = CASE
                            WHEN "rate_limits"."reset_at" <= NOW() THEN 1
                            ELSE "rate_limits"."count" + 1
                          END,
             "reset_at" = CASE
                            WHEN "rate_limits"."reset_at" <= NOW()
                              THEN NOW() + make_interval(secs => $2)
                            ELSE "rate_limits"."reset_at"
                          END
       RETURNING "count", "reset_at"`,
      identifier,
      windowSeconds,
    );

    const row = rows[0];
    const count = Number(row.count);
    const resetTime = new Date(row.reset_at).getTime();
    const remaining = Math.max(0, config.maxRequests - count);
    const success = count <= config.maxRequests;

    if (!success) {
      logger.rateLimitExceeded(identifier, "api", {
        remaining: 0,
        resetTime,
      });
    }

    return { success, remaining, resetTime, total: config.maxRequests };
  } catch (error) {
    // If the database is unreachable, fail open (allow the request) to avoid
    // blocking all traffic when PG is temporarily unavailable.
    logger.error("Rate limit check failed, allowing request", {
      error,
      identifier,
    });
    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      total: config.maxRequests,
    };
  }
}

/**
 * Create rate limit headers for HTTP responses.
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.total.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set(
    "X-RateLimit-Reset",
    Math.ceil(result.resetTime / 1000).toString(),
  );
  if (!result.success) {
    headers.set(
      "Retry-After",
      Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
    );
  }
  return headers;
}

/**
 * Pre-configured rate limiters for different use cases.
 */
export const rateLimiters = {
  /**
   * Login endpoint - strict limit to prevent brute force
   * 5 attempts per 15 minutes per IP
   */
  login: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: "Too many login attempts. Please try again in 15 minutes.",
  },

  /**
   * API endpoints - general rate limit
   * 100 requests per minute per IP
   */
  api: {
    maxRequests: 100,
    windowMs: 60 * 1000, // 1 minute
    message: "Too many requests. Please try again later.",
  },

  /**
   * Write operations (POST, PUT, DELETE) - more restrictive
   * 30 requests per minute per IP
   */
  write: {
    maxRequests: 30,
    windowMs: 60 * 1000, // 1 minute
    message: "Too many write operations. Please slow down.",
  },

  /**
   * Password reset - very strict to prevent abuse
   * 3 attempts per hour per IP
   */
  passwordReset: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: "Too many password reset attempts. Please try again later.",
  },
};

/**
 * Get the client IP address from request headers.
 */
export function getClientIP(request: Request): string {
  // Check common proxy headers
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // Take the first IP in the list (client IP)
    return forwardedFor.split(",")[0].trim();
  }

  const realIP = request.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }

  // Fallback for local development
  return "127.0.0.1";
}

/**
 * Create a rate-limited response with appropriate headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string,
): Response {
  const headers = createRateLimitHeaders(result);
  return new Response(
    JSON.stringify({
      error: message || "Rate limit exceeded",
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        ...Object.fromEntries(headers),
      },
    },
  );
}

/**
 * Reset rate limit for a specific identifier.
 * Useful for testing or after successful authentication.
 */
export async function resetRateLimit(identifier: string): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM "rate_limits" WHERE "key" = $1`,
      identifier,
    );
  } catch (error) {
    logger.error("Failed to reset rate limit", { error, identifier });
  }
}

/**
 * Get current rate limit status for an identifier.
 */
export async function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  try {
    const rows = await prisma.$queryRawUnsafe<
      Array<{ count: number; reset_at: Date }>
    >(
      `SELECT "count", "reset_at" FROM "rate_limits"
       WHERE "key" = $1 AND "reset_at" > NOW()`,
      identifier,
    );

    if (rows.length === 0) {
      return {
        success: true,
        remaining: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
        total: config.maxRequests,
      };
    }

    const row = rows[0];
    const count = Number(row.count);
    const resetTime = new Date(row.reset_at).getTime();

    return {
      success: count < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      resetTime,
      total: config.maxRequests,
    };
  } catch (error) {
    logger.error("Failed to get rate limit status", { error, identifier });
    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: Date.now() + config.windowMs,
      total: config.maxRequests,
    };
  }
}
