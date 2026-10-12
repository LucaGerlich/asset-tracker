import { describe, it, expect, vi, afterEach } from "vitest";
import {
  isLegacyBillingActive,
  isLegacyPlan,
  legacyLimit,
  legacyPlanToEntitlements,
} from "@/lib/legacy-billing";

const PROFESSIONAL = [
  "api_keys",
  "procurement",
  "advanced_reports",
  "tco_dashboard",
  "custom_fields",
  "workflow_automation",
];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("legacyPlanToEntitlements", () => {
  it("gives starter no features", () => {
    expect(legacyPlanToEntitlements("starter", 100, 3)).toEqual({
      features: [],
      maxAssets: 100,
      maxUsers: 3,
    });
  });

  it("gives professional the professional features", () => {
    expect(legacyPlanToEntitlements("professional", 5000, 25)).toEqual({
      features: PROFESSIONAL,
      maxAssets: 5000,
      maxUsers: 25,
    });
  });

  it("gives enterprise professional plus scim", () => {
    expect(legacyPlanToEntitlements("enterprise", -1, -1)).toEqual({
      features: [
        "api_keys",
        "procurement",
        "scim",
        "advanced_reports",
        "tco_dashboard",
        "custom_fields",
        "workflow_automation",
      ],
      maxAssets: null,
      maxUsers: null,
    });
  });

  it("maps the webhook's 999999 and the plan table's -1 to the same value", () => {
    expect(legacyPlanToEntitlements("enterprise", 999999, 999999)).toEqual(
      legacyPlanToEntitlements("enterprise", -1, -1),
    );
  });

  it("maps an unknown plan to starter features", () => {
    expect(legacyPlanToEntitlements("gold", 100, 3).features).toEqual([]);
  });
});

describe("legacyLimit", () => {
  it.each([
    [-1, null],
    [999999, null],
    [1000000, null],
    [0, 0],
    [25, 25],
    [-5, 0],
  ])("maps %s to %s", (input, expected) => {
    expect(legacyLimit(input)).toBe(expected);
  });
});

describe("isLegacyPlan", () => {
  it("knows the three legacy plans only", () => {
    expect(["starter", "professional", "enterprise"].every(isLegacyPlan)).toBe(
      true,
    );
    expect(isLegacyPlan("gold")).toBe(false);
    expect(isLegacyPlan("toString")).toBe(false);
  });
});

describe("isLegacyBillingActive", () => {
  it("is true when the Stripe secret key is set", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    expect(isLegacyBillingActive()).toBe(true);
  });

  it("is false when it is unset or empty", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(isLegacyBillingActive()).toBe(false);
  });
});
