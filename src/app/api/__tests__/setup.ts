import { vi } from "vitest";

/**
 * Common mock setup for API route integration tests.
 * Call vi.mock() at the top-level of each test file instead of using
 * this function, because vi.mock is hoisted by Vitest.
 *
 * This file provides reusable mock factory helpers.
 */

export function createMockLogger() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    rateLimitExceeded: vi.fn(),
  };
}

export function createMockAuthUser(overrides = {}) {
  return {
    id: "admin-uuid-001",
    isAdmin: true,
    canRequest: true,
    name: "Admin User",
    email: "admin@test.com",
    username: "admin",
    firstname: "Admin",
    lastname: "User",
    organizationId: "org-uuid-001",
    ...overrides,
  };
}

export function createMockOrgContext(overrides = {}) {
  return {
    organization: { id: "org-uuid-001" },
    userId: "admin-uuid-001",
    isAdmin: true,
    ...overrides,
  };
}
