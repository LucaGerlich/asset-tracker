import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    rateLimitExceeded: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock prisma with raw query methods
const mockQueryRawUnsafe = vi.fn();
const mockExecuteRawUnsafe = vi.fn();

vi.mock("@/lib/prisma", () => ({
  default: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
    $executeRawUnsafe: (...args: unknown[]) => mockExecuteRawUnsafe(...args),
  },
}));

import {
  checkRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIP,
  resetRateLimit,
} from "@/lib/rate-limit";
import type { RateLimitResult } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";

const DEFAULT_CONFIG = { maxRequests: 3, windowMs: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  mockExecuteRawUnsafe.mockResolvedValue(0);
});

// ---------------------------------------------------------------------------
// checkRateLimit
// ---------------------------------------------------------------------------
describe("checkRateLimit", () => {
  it("allows the first request and reports correct remaining count", async () => {
    const resetAt = new Date(Date.now() + 100);
    mockQueryRawUnsafe.mockResolvedValue([{ count: 1, reset_at: resetAt }]);

    const result = await checkRateLimit("test", DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.total).toBe(3);
  });

  it("allows requests up to the configured limit", async () => {
    const resetAt = new Date(Date.now() + 100);

    mockQueryRawUnsafe.mockResolvedValueOnce([{ count: 1, reset_at: resetAt }]);
    const first = await checkRateLimit("test", DEFAULT_CONFIG);

    mockQueryRawUnsafe.mockResolvedValueOnce([{ count: 2, reset_at: resetAt }]);
    const second = await checkRateLimit("test", DEFAULT_CONFIG);

    mockQueryRawUnsafe.mockResolvedValueOnce([{ count: 3, reset_at: resetAt }]);
    const third = await checkRateLimit("test", DEFAULT_CONFIG);

    expect(first.success).toBe(true);
    expect(first.remaining).toBe(2);

    expect(second.success).toBe(true);
    expect(second.remaining).toBe(1);

    expect(third.success).toBe(true);
    expect(third.remaining).toBe(0);
  });

  it("blocks requests once the limit is exceeded", async () => {
    const resetAt = new Date(Date.now() + 100);
    mockQueryRawUnsafe.mockResolvedValue([{ count: 4, reset_at: resetAt }]);

    const blocked = await checkRateLimit("test", DEFAULT_CONFIG);

    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("logs when the rate limit is exceeded", async () => {
    const resetAt = new Date(Date.now() + 100);
    mockQueryRawUnsafe.mockResolvedValue([{ count: 4, reset_at: resetAt }]);

    await checkRateLimit("test", DEFAULT_CONFIG);

    expect(logger.rateLimitExceeded).toHaveBeenCalledWith(
      "test",
      "api",
      expect.objectContaining({ remaining: 0 }),
    );
  });

  it("fails open when the database is unavailable", async () => {
    mockQueryRawUnsafe.mockRejectedValue(new Error("Connection refused"));

    const result = await checkRateLimit("test", DEFAULT_CONFIG);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(3);
    expect(logger.error).toHaveBeenCalled();
  });

  it("tracks different identifiers independently via separate queries", async () => {
    const resetAt = new Date(Date.now() + 100);
    mockQueryRawUnsafe.mockResolvedValue([{ count: 4, reset_at: resetAt }]);

    const blockedTest = await checkRateLimit("test", DEFAULT_CONFIG);
    expect(blockedTest.success).toBe(false);

    // Verify the key passed to the query
    expect(mockQueryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      "test",
      expect.any(Number),
    );

    mockQueryRawUnsafe.mockResolvedValue([{ count: 1, reset_at: resetAt }]);
    const otherResult = await checkRateLimit("other", DEFAULT_CONFIG);
    expect(otherResult.success).toBe(true);
    expect(otherResult.remaining).toBe(2);

    expect(mockQueryRawUnsafe).toHaveBeenLastCalledWith(
      expect.any(String),
      "other",
      expect.any(Number),
    );
  });
});

// ---------------------------------------------------------------------------
// resetRateLimit
// ---------------------------------------------------------------------------
describe("resetRateLimit", () => {
  it("deletes the rate limit row for a specific identifier", async () => {
    await resetRateLimit("test");

    expect(mockExecuteRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining("DELETE"),
      "test",
    );
  });

  it("does not throw when resetting a non-existent identifier", async () => {
    mockExecuteRawUnsafe.mockResolvedValue(0);
    await expect(resetRateLimit("nonexistent")).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// createRateLimitHeaders
// ---------------------------------------------------------------------------
describe("createRateLimitHeaders", () => {
  it("sets X-RateLimit-Limit and X-RateLimit-Remaining headers", () => {
    const result: RateLimitResult = {
      success: true,
      remaining: 7,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const headers = createRateLimitHeaders(result);

    expect(headers.get("X-RateLimit-Limit")).toBe("10");
    expect(headers.get("X-RateLimit-Remaining")).toBe("7");
  });

  it("sets X-RateLimit-Reset as a unix timestamp in seconds", () => {
    const resetTime = Date.now() + 60_000;
    const result: RateLimitResult = {
      success: true,
      remaining: 5,
      resetTime,
      total: 10,
    };

    const headers = createRateLimitHeaders(result);
    const resetHeader = Number(headers.get("X-RateLimit-Reset"));

    expect(resetHeader).toBe(Math.ceil(resetTime / 1000));
  });

  it("includes Retry-After header only when rate limited", () => {
    const successResult: RateLimitResult = {
      success: true,
      remaining: 5,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const failureResult: RateLimitResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const successHeaders = createRateLimitHeaders(successResult);
    const failureHeaders = createRateLimitHeaders(failureResult);

    expect(successHeaders.get("Retry-After")).toBeNull();
    expect(failureHeaders.get("Retry-After")).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createRateLimitResponse
// ---------------------------------------------------------------------------
describe("createRateLimitResponse", () => {
  it("returns a 429 status response", () => {
    const result: RateLimitResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const response = createRateLimitResponse(result);

    expect(response.status).toBe(429);
  });

  it("includes the default error message in the response body", async () => {
    const result: RateLimitResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const response = createRateLimitResponse(result);
    const body = await response.json();

    expect(body.error).toBe("Rate limit exceeded");
    expect(body.retryAfter).toBeGreaterThan(0);
  });

  it("uses a custom message when provided", async () => {
    const result: RateLimitResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const response = createRateLimitResponse(result, "Slow down please");
    const body = await response.json();

    expect(body.error).toBe("Slow down please");
  });

  it("sets Content-Type to application/json", () => {
    const result: RateLimitResult = {
      success: false,
      remaining: 0,
      resetTime: Date.now() + 60_000,
      total: 10,
    };

    const response = createRateLimitResponse(result);

    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});

// ---------------------------------------------------------------------------
// getClientIP
// ---------------------------------------------------------------------------
describe("getClientIP", () => {
  it("extracts the first IP from x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
      },
    });

    expect(getClientIP(request)).toBe("203.0.113.50");
  });

  it("returns x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.42" },
    });

    expect(getClientIP(request)).toBe("198.51.100.42");
  });

  it("falls back to 127.0.0.1 when no proxy headers are present", () => {
    const request = new Request("http://localhost");

    expect(getClientIP(request)).toBe("127.0.0.1");
  });

  it("prefers x-forwarded-for over x-real-ip when both are set", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.50",
        "x-real-ip": "198.51.100.42",
      },
    });

    expect(getClientIP(request)).toBe("203.0.113.50");
  });
});
