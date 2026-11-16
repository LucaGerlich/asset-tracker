import { describe, it, expect } from "vitest";
import { canRequestReturn } from "@/lib/return-eligibility";

describe("canRequestReturn", () => {
  it("allows an approved, non-consumable request that carries an entityId", () => {
    expect(
      canRequestReturn({
        status: "approved",
        entityType: "asset",
        entityId: "a1",
      }),
    ).toBe(true);
  });

  it("rejects a request without entityId (POST /api/requests would 400)", () => {
    expect(
      canRequestReturn({
        status: "approved",
        entityType: "asset",
        entityId: undefined,
      }),
    ).toBe(false);
  });

  it("rejects consumables and non-approved requests", () => {
    expect(
      canRequestReturn({
        status: "approved",
        entityType: "consumable",
        entityId: "c1",
      }),
    ).toBe(false);
    expect(
      canRequestReturn({
        status: "pending",
        entityType: "asset",
        entityId: "a1",
      }),
    ).toBe(false);
  });
});
