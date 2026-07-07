import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  validateEnvironment,
  getEnvVar,
  getOptionalEnvVar,
  getBoolEnvVar,
  getIntEnvVar,
} from "@/lib/env-validation";

describe("env-validation", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/testdb");
    vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_SECRET", "a]3Kf9$mPqR7vLxW2nBtYcZeAsDgHjMk");
    vi.stubEnv("CRON_SECRET", "test-cron-secret-value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("validateEnvironment", () => {
    it("returns valid=true when all required variables are set", () => {
      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("returns errors for missing required variables", () => {
      vi.unstubAllEnvs();

      const result = validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes("DATABASE_URL"))).toBe(true);
      expect(result.errors.some((e) => e.includes("BETTER_AUTH_URL"))).toBe(
        true,
      );
      expect(result.errors.some((e) => e.includes("BETTER_AUTH_SECRET"))).toBe(
        true,
      );
    });

    it("returns validation errors for invalid variable values", () => {
      vi.stubEnv("DATABASE_URL", "not-a-postgres-url");

      const result = validateEnvironment();

      expect(result.valid).toBe(false);
      expect(
        result.errors.some(
          (e) => e.includes("DATABASE_URL") && e.includes("Invalid"),
        ),
      ).toBe(true);
    });

    it("masks sensitive variable values in the result", () => {
      const result = validateEnvironment();

      const dbVar = result.variables["DATABASE_URL"];
      expect(dbVar.masked).toBe(true);
      expect(dbVar.value).not.toBe("postgresql://localhost:5432/testdb");
      expect(dbVar.value).toContain("****");
    });
  });

  describe("getEnvVar", () => {
    it("returns the value of a set environment variable", () => {
      vi.stubEnv("MY_TEST_VAR", "hello");

      expect(getEnvVar("MY_TEST_VAR")).toBe("hello");
    });

    it("throws an error when a required variable is missing", () => {
      expect(() => getEnvVar("COMPLETELY_UNDEFINED_VAR")).toThrow(
        "Environment variable COMPLETELY_UNDEFINED_VAR is not defined",
      );
    });

    it("returns the default value when the variable is missing and a default is provided", () => {
      expect(getEnvVar("COMPLETELY_UNDEFINED_VAR", "fallback")).toBe(
        "fallback",
      );
    });
  });

  describe("getOptionalEnvVar", () => {
    it("returns the value when the variable is set", () => {
      vi.stubEnv("OPTIONAL_VAR", "present");

      expect(getOptionalEnvVar("OPTIONAL_VAR")).toBe("present");
    });

    it("returns undefined when the variable is not set and no default is provided", () => {
      expect(getOptionalEnvVar("COMPLETELY_UNDEFINED_VAR")).toBeUndefined();
    });
  });

  describe("getBoolEnvVar", () => {
    it('returns true when the variable is set to "true"', () => {
      vi.stubEnv("BOOL_VAR", "true");

      expect(getBoolEnvVar("BOOL_VAR")).toBe(true);
    });

    it('returns false when the variable is set to "false"', () => {
      vi.stubEnv("BOOL_VAR", "false");

      expect(getBoolEnvVar("BOOL_VAR")).toBe(false);
    });

    it("returns the default value when the variable is not set", () => {
      expect(getBoolEnvVar("COMPLETELY_UNDEFINED_VAR")).toBe(false);
      expect(getBoolEnvVar("COMPLETELY_UNDEFINED_VAR", true)).toBe(true);
    });
  });

  describe("getIntEnvVar", () => {
    it("parses a valid integer string", () => {
      vi.stubEnv("INT_VAR", "42");

      expect(getIntEnvVar("INT_VAR")).toBe(42);
    });

    it("throws an error for non-numeric values", () => {
      vi.stubEnv("INT_VAR", "not-a-number");

      expect(() => getIntEnvVar("INT_VAR")).toThrow(
        "Environment variable INT_VAR is not a valid integer",
      );
    });
  });
});
