import { describe, it, expect } from "vitest";
import {
  updateComponentSchema,
  updateAuditCampaignSchema,
  updateKitSchema,
  createComponentSchema,
  createAuditCampaignSchema,
} from "../validation";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

describe("update schemas must not re-apply create defaults", () => {
  it("updateComponentSchema leaves untouched fields undefined on a rename", () => {
    const result = updateComponentSchema.parse({ name: "Renamed" });
    expect(result).toEqual({ name: "Renamed" });
    expect(result.totalQuantity).toBeUndefined();
    expect(result.minQuantity).toBeUndefined();
  });

  it("updateComponentSchema still validates provided quantities", () => {
    expect(updateComponentSchema.safeParse({ totalQuantity: -1 }).success).toBe(
      false,
    );
    expect(
      updateComponentSchema.parse({ totalQuantity: 5, minQuantity: 2 }),
    ).toEqual({ totalQuantity: 5, minQuantity: 2 });
  });

  it("updateComponentSchema validates remainingQuantity as a non-negative int", () => {
    expect(
      updateComponentSchema.parse({ remainingQuantity: 3 }).remainingQuantity,
    ).toBe(3);
    expect(
      updateComponentSchema.safeParse({ remainingQuantity: -1 }).success,
    ).toBe(false);
    expect(
      updateComponentSchema.safeParse({ remainingQuantity: 1.5 }).success,
    ).toBe(false);
    expect(
      updateComponentSchema.safeParse({ remainingQuantity: "9" }).success,
    ).toBe(false);
  });

  it("createComponentSchema keeps its defaults", () => {
    const result = createComponentSchema.parse({
      name: "Cable",
      categoryId: uuid,
    });
    expect(result.totalQuantity).toBe(0);
    expect(result.minQuantity).toBe(0);
  });

  it("updateAuditCampaignSchema does not reset scopeType on a rename", () => {
    const result = updateAuditCampaignSchema.parse({ name: "Q4" });
    expect(result).toEqual({ name: "Q4" });
    expect(result.scopeType).toBeUndefined();
  });

  it("createAuditCampaignSchema keeps the scopeType default", () => {
    expect(createAuditCampaignSchema.parse({ name: "Q4" }).scopeType).toBe(
      "all",
    );
  });

  it("updateKitSchema yields no defaults for a bare rename", () => {
    expect(updateKitSchema.parse({ name: "Kit" })).toEqual({ name: "Kit" });
  });
});
