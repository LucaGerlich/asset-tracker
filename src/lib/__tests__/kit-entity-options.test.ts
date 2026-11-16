import { describe, it, expect } from "vitest";
import { toKitEntityOptions } from "@/lib/kit-entity-options";

describe("toKitEntityOptions", () => {
  it("maps asset categories", () => {
    expect(
      toKitEntityOptions("asset_category", [
        { assetcategorytypeid: "c1", assetcategorytypename: "Laptops" },
      ]),
    ).toEqual([{ id: "c1", label: "Laptops" }]);
  });

  it("labels accessories with their tag", () => {
    expect(
      toKitEntityOptions("accessory", [
        { accessorieid: "a1", accessoriename: "Dock", accessorietag: "D-1" },
        { accessorieid: "a2", accessoriename: "Mouse", accessorietag: "" },
      ]),
    ).toEqual([
      { id: "a1", label: "Dock (D-1)" },
      { id: "a2", label: "Mouse" },
    ]);
  });

  it("never puts a full licence key into a label", () => {
    const [option] = toKitEntityOptions("licence", [
      { licenceid: "00000000-aaaa", licencekey: "ABCD-EFGH-1234-5678" },
    ]);
    expect(option.id).toBe("00000000-aaaa");
    expect(option.label).toBe("Licence (key …5678)");
    expect(option.label).not.toContain("ABCD");
  });

  it("maps components by id and name", () => {
    expect(
      toKitEntityOptions("component", [{ id: "k1", name: "RAM 16GB" }]),
    ).toEqual([{ id: "k1", label: "RAM 16GB" }]);
  });

  it("returns nothing for an error body or malformed rows", () => {
    expect(toKitEntityOptions("component", { error: "Forbidden" })).toEqual([]);
    expect(toKitEntityOptions("component", [null, 5, {}])).toEqual([]);
  });
});
