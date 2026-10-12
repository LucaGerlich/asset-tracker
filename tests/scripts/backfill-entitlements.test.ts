import { describe, it, expect } from "vitest";
import { GATED_FEATURES } from "@/lib/entitlements-shared";
import { currentAccessFor } from "../../scripts/lib/backfill-entitlements";

describe("currentAccessFor", () => {
  it("is every feature on a self-hosted deployment", () => {
    expect(currentAccessFor("starter", true)).toEqual([...GATED_FEATURES]);
  });

  it("gives starter every feature that was never enforced", () => {
    expect(currentAccessFor("starter", false)).toEqual([
      "scim",
      "advanced_reports",
      "tco_dashboard",
      "custom_fields",
      "workflow_automation",
    ]);
  });

  it("gives professional everything", () => {
    expect(currentAccessFor("professional", false)).toEqual([
      ...GATED_FEATURES,
    ]);
  });

  it("treats an unknown plan like starter", () => {
    expect(currentAccessFor("gold", false)).toEqual(
      currentAccessFor("starter", false),
    );
  });
});
