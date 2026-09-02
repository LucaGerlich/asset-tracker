import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
// Integration tests: exercise the real Postgres-backed cache/lockout tables.
// Skipped when no DATABASE_URL is configured (they run in CI against a test DB).
const describeDb = process.env.DATABASE_URL ? describe : describe.skip;

vi.mock("@/lib/logger", () => ({
  logger: {
    securityEvent: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/feature-flags", () => ({
  isFeatureEnabled: () => true,
}));

import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import {
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  unlockAccount,
  formatLockoutMessage,
  getLockoutStatus,
  LOCKOUT_CONFIG,
} from "@/lib/account-lockout";

const TEST_IDENTIFIERS = ["test-user", "unknown-user", "totally-unknown-user"];

describeDb("account-lockout", () => {
  beforeEach(async () => {
    await recordSuccessfulLogin("test-user");
  });

  afterAll(async () => {
    if (!process.env.DATABASE_URL) return;
    const schema = process.env.DB_SCHEMA || "assettool";
    await prisma.$executeRawUnsafe(
      `DELETE FROM "${schema}"."account_lockouts" WHERE "key" = ANY($1)`,
      TEST_IDENTIFIERS,
    );
  });

  describe("isAccountLocked", () => {
    it("returns false for an unknown user with no history", async () => {
      const result = await isAccountLocked("unknown-user");

      expect(result.locked).toBe(false);
      expect(result.remainingMs).toBeUndefined();
      expect(result.unlockTime).toBeUndefined();
    });

    it("returns true with remaining time for a locked user", async () => {
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }

      const result = await isAccountLocked("test-user");

      expect(result.locked).toBe(true);
      expect(result.remainingMs).toBeGreaterThan(0);
      expect(result.unlockTime).toBeInstanceOf(Date);
    });
  });

  describe("recordFailedAttempt", () => {
    it("increments attempts and returns correct attemptsRemaining", async () => {
      const first = await recordFailedAttempt("test-user");
      expect(first.locked).toBe(false);
      expect(first.attemptsRemaining).toBe(LOCKOUT_CONFIG.maxAttempts - 1);

      const second = await recordFailedAttempt("test-user");
      expect(second.locked).toBe(false);
      expect(second.attemptsRemaining).toBe(LOCKOUT_CONFIG.maxAttempts - 2);
    });

    it("locks the account after reaching maxAttempts", async () => {
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts - 1; i++) {
        const result = await recordFailedAttempt("test-user");
        expect(result.locked).toBe(false);
      }

      const lockResult = await recordFailedAttempt("test-user");

      expect(lockResult.locked).toBe(true);
      expect(lockResult.attemptsRemaining).toBe(0);
      expect(lockResult.lockoutDurationMs).toBeDefined();
      expect(lockResult.unlockTime).toBeInstanceOf(Date);
    });

    it("passes context through to the logger", async () => {
      await recordFailedAttempt("test-user", {
        ipAddress: "192.168.1.1",
        userAgent: "TestAgent",
      });

      expect(logger.securityEvent).toHaveBeenCalledWith(
        "Failed login attempt",
        expect.objectContaining({
          identifier: "test-user",
          ipAddress: "192.168.1.1",
          userAgent: "TestAgent",
        }),
      );
    });
  });

  describe("recordSuccessfulLogin", () => {
    it("resets the lockout counter so subsequent checks show unlocked", async () => {
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }
      expect((await isAccountLocked("test-user")).locked).toBe(true);

      await recordSuccessfulLogin("test-user");

      expect((await isAccountLocked("test-user")).locked).toBe(false);

      const status = await getLockoutStatus("test-user");
      expect(status.failedAttempts).toBe(0);
    });

    it("is a no-op for users with no lockout history", async () => {
      await expect(
        recordSuccessfulLogin("nonexistent-user"),
      ).resolves.not.toThrow();
    });
  });

  describe("unlockAccount", () => {
    it("manually unlocks a locked account and returns true", async () => {
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }
      expect((await isAccountLocked("test-user")).locked).toBe(true);

      const result = await unlockAccount("test-user", "admin-1");

      expect(result).toBe(true);
      expect((await isAccountLocked("test-user")).locked).toBe(false);
    });

    it("returns false for an unknown user with no entry", async () => {
      const result = await unlockAccount("totally-unknown-user");

      expect(result).toBe(false);
    });
  });

  describe("formatLockoutMessage", () => {
    it("formats durations under 1 minute as about a minute", () => {
      const message = formatLockoutMessage(30 * 1000);

      expect(message).toContain("about a minute");
    });

    it("formats durations of exactly 1 minute as about a minute", () => {
      const message = formatLockoutMessage(60 * 1000);

      expect(message).toContain("about a minute");
    });

    it("formats durations in the minutes range", () => {
      const message = formatLockoutMessage(15 * 60 * 1000);

      expect(message).toContain("15 minutes");
    });

    it("formats durations of exactly 1 hour", () => {
      const message = formatLockoutMessage(60 * 60 * 1000);

      expect(message).toContain("about an hour");
    });

    it("formats durations of multiple hours", () => {
      const message = formatLockoutMessage(24 * 60 * 60 * 1000);

      expect(message).toContain("24 hours");
    });
  });

  describe("getLockoutStatus", () => {
    it("returns zeroed-out state for a user with no history", async () => {
      const status = await getLockoutStatus("fresh-user");

      expect(status.failedAttempts).toBe(0);
      expect(status.lockedUntil).toBeNull();
      expect(status.lastAttempt).toBeNull();
      expect(status.isLocked).toBe(false);
    });

    it("returns accurate state after failed attempts and lockout", async () => {
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }

      const status = await getLockoutStatus("test-user");

      expect(status.failedAttempts).toBe(LOCKOUT_CONFIG.maxAttempts);
      expect(status.lockedUntil).toBeInstanceOf(Date);
      expect(status.lastAttempt).toBeInstanceOf(Date);
      expect(status.isLocked).toBe(true);
    });
  });

  describe("progressive lockout", () => {
    it("doubles the lockout duration on repeated lockouts", async () => {
      // First lockout: trigger maxAttempts failures
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }

      const firstLockout = await getLockoutStatus("test-user");
      const firstDuration =
        firstLockout.lockedUntil!.getTime() -
        firstLockout.lastAttempt!.getTime();

      // Continue failing to trigger a second lockout cycle
      // The account is already locked but attempts still accumulate
      for (let i = 0; i < LOCKOUT_CONFIG.maxAttempts; i++) {
        await recordFailedAttempt("test-user");
      }

      const secondLockout = await getLockoutStatus("test-user");
      const secondDuration =
        secondLockout.lockedUntil!.getTime() -
        secondLockout.lastAttempt!.getTime();

      expect(secondDuration).toBe(firstDuration * 2);
    });
  });
});
