/**
 * In-memory rate limiter
 * For production, consider using Redis-based rate limiting (e.g., @upstash/ratelimit)
 */

import { logger } from "@/lib/logger";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Custom message when rate limit is exceeded */
  message?: string;
}

// In-memory storage for rate limits
const rateLimitStore = new Map<string, RateLimitEntry>();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetTime < now) {
        rateLimitStore.delete(key);
      }
    }
  }, CLEANUP_INTERVAL);
  // Prevent cleanup timer from keeping Node.js alive
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

// Start cleanup when module is loaded
startCleanup();

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetTime: number;
  total: number;
}

/**
 * Check if a request should be rate limited
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const key = identifier;
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry
    const resetTime = now + config.windowMs;
    rateLimitStore.set(key, { count: 1, resetTime });
    return {
      success: true,
      remaining: config.maxRequests - 1,
      resetTime,
      total: config.maxRequests,
    };
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    logger.rateLimitExceeded(identifier, "api", {
      remaining: 0,
      resetTime: entry.resetTime,
    });
    return {
      success: false,
      remaining: 0,
      resetTime: entry.resetTime,
      total: config.maxRequests,
    };
  }

  // Increment counter
  entry.count++;
  return {
    success: true,
    remaining: config.maxRequests - entry.count,
    resetTime: entry.resetTime,
    total: config.maxRequests,
  };
}

/**
 * Create rate limit headers for HTTP responses
 */
export function createRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", result.total.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set(
    "X-RateLimit-Reset",
    Math.ceil(result.resetTime / 1000).toString()
  );
  if (!result.success) {
    headers.set(
      "Retry-After",
      Math.ceil((result.resetTime - Date.now()) / 1000).toString()
    );
  }
  return headers;
}

/**
 * Pre-configured rate limiters for different use cases
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
 * Get the client IP address from request headers
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
 * Create a rate-limited response with appropriate headers
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  message?: string
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
    }
  );
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or after successful authentication
 */
export function resetRateLimit(identifier: string): void {
  rateLimitStore.delete(identifier);
}

/**
 * Get current rate limit status for an identifier
 */
export function getRateLimitStatus(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry || entry.resetTime < now) {
    return {
      success: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs,
      total: config.maxRequests,
    };
  }

  return {
    success: entry.count < config.maxRequests,
    remaining: Math.max(0, config.maxRequests - entry.count),
    resetTime: entry.resetTime,
    total: config.maxRequests,
  };
}
