import { expect } from "vitest";

/** Columns that must never reach a tenant through an organization route. */
export const HIDDEN_ORG_FIELDS = [
  "plan",
  "stripeCustomerId",
  "stripeSubscriptionId",
  "trialEndsAt",
  "maxAssets",
  "maxUsers",
  "suspendedAt",
  "entitlements",
  "lockedAt",
] as const;

/** Asserts a Prisma call uses an explicit select without any hidden column. */
export function expectAllowListSelect(args: unknown): void {
  const query = args as { select?: Record<string, unknown>; include?: unknown };
  expect(query.include).toBeUndefined();
  expect(query.select).toBeDefined();
  for (const field of HIDDEN_ORG_FIELDS) {
    expect(query.select).not.toHaveProperty(field);
  }
}
