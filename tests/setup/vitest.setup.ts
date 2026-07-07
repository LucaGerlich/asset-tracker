import { vi } from "vitest";

/**
 * Global test setup (wired via vitest.config.ts `setupFiles`).
 *
 * Route handlers frequently call Next.js request APIs (`headers()`, `cookies()`)
 * outside a real request scope in unit tests, which throws
 * "`headers` was called outside a request scope". Mock them globally so unit
 * tests exercise handler logic without a live server. A test can still override
 * these with its own `vi.mock` if it needs specific header/cookie values.
 */
vi.mock("next/headers", () => ({
  headers: () => new Headers(),
  cookies: () => ({
    get: () => undefined,
    getAll: () => [],
    has: () => false,
    set: () => {},
    delete: () => {},
  }),
}));
