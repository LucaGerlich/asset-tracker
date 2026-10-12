import { describe, it, expect } from "vitest";
import { organizationApiSelect } from "@/lib/organizations";

describe("organizationApiSelect", () => {
  it("selects only the fields tenants may see", () => {
    expect(Object.keys(organizationApiSelect).sort()).toEqual([
      "createdAt",
      "description",
      "id",
      "isActive",
      "name",
      "settings",
      "slug",
      "updatedAt",
    ]);
  });
});
