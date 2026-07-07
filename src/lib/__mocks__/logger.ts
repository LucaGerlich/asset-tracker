import { vi } from "vitest";

/**
 * Vitest automock for `@/lib/logger`.
 *
 * The real logger grows methods over time (apiResponse, apiError,
 * rateLimitExceeded, …); a hand-written mock that omits one causes routes to
 * throw "No X export defined on mock" the moment they call it. The Proxy returns
 * a cached vi.fn() for any method accessed, so the mock never goes stale.
 */

const loggerMethods = new Map<string, ReturnType<typeof vi.fn>>();

export const logger = new Proxy(
  {},
  {
    get(_target, prop) {
      if (typeof prop === "symbol") return undefined;
      if (!loggerMethods.has(prop)) loggerMethods.set(prop, vi.fn());
      return loggerMethods.get(prop);
    },
  },
);

// logCatchError(context) returns a rejection handler used as `.catch(handler)`.
export const logCatchError = vi.fn(() => vi.fn());

export const maskSensitiveData = vi.fn(<T>(data: T): T => data);
export const generateCorrelationId = vi.fn(() => "test-correlation-id");
export const getCorrelationId = vi.fn((): string | undefined => undefined);
export const withCorrelationId = vi.fn(
  <T>(_id: string, fn: () => T): T => fn(),
);
export const withCorrelationIdAsync = vi.fn(
  async <T>(_id: string, fn: () => Promise<T> | T): Promise<T> => fn(),
);

export class Logger {}
