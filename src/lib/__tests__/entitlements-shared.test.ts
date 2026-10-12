import { describe, it, expect } from "vitest";
import {
  GATED_FEATURES,
  UNRESTRICTED,
  entitlementsSchema,
  featuresInOrder,
  isOverLimit,
} from "@/lib/entitlements-shared";

describe("entitlementsSchema", () => {
  it("accepts a valid value", () => {
    const value = { features: ["api_keys"], maxAssets: 10, maxUsers: null };
    expect(entitlementsSchema.parse(value)).toEqual(value);
  });

  it("rejects an unknown feature", () => {
    expect(
      entitlementsSchema.safeParse({
        features: ["white_label"],
        maxAssets: null,
        maxUsers: null,
      }).success,
    ).toBe(false);
  });

  it("rejects unknown keys", () => {
    expect(
      entitlementsSchema.safeParse({
        features: [],
        maxAssets: null,
        maxUsers: null,
        plan: "pro",
      }).success,
    ).toBe(false);
  });

  it.each([-1, 1.5, "10"])("rejects the limit %s", (maxAssets) => {
    expect(
      entitlementsSchema.safeParse({ features: [], maxAssets, maxUsers: null })
        .success,
    ).toBe(false);
  });

  it("accepts zero as a limit", () => {
    expect(
      entitlementsSchema.safeParse({ features: [], maxAssets: 0, maxUsers: 0 })
        .success,
    ).toBe(true);
  });

  it("requires every key", () => {
    expect(entitlementsSchema.safeParse({ features: [] }).success).toBe(false);
  });
});

describe("UNRESTRICTED", () => {
  it("grants every feature without limits", () => {
    expect(UNRESTRICTED).toEqual({
      features: [...GATED_FEATURES],
      maxAssets: null,
      maxUsers: null,
    });
  });
});

describe("isOverLimit", () => {
  const limits = { features: [], maxAssets: 10, maxUsers: 3 };

  it("is false at the limit", () => {
    expect(isOverLimit(limits, { assets: 10, users: 3 })).toBe(false);
  });

  it("is true above either limit", () => {
    expect(isOverLimit(limits, { assets: 11, users: 0 })).toBe(true);
    expect(isOverLimit(limits, { assets: 0, users: 4 })).toBe(true);
  });

  it("never applies a null limit", () => {
    expect(
      isOverLimit(
        { features: [], maxAssets: null, maxUsers: null },
        { assets: 1e9, users: 1e9 },
      ),
    ).toBe(false);
  });

  it("treats a zero limit as a real limit", () => {
    expect(
      isOverLimit(
        { features: [], maxAssets: 0, maxUsers: null },
        { assets: 1, users: 0 },
      ),
    ).toBe(true);
  });
});

describe("featuresInOrder", () => {
  it("deduplicates and sorts by GATED_FEATURES order", () => {
    expect(featuresInOrder(["scim", "api_keys", "scim"])).toEqual([
      "api_keys",
      "scim",
    ]);
  });
});
