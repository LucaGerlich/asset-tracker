import { describe, it, expect } from "vitest";
import { parseCustomFieldOptions } from "@/lib/custom-field-options";
import { createCustomFieldDefinitionSchema } from "@/lib/validation";

describe("parseCustomFieldOptions", () => {
  it("reads a JSON array string", () => {
    expect(parseCustomFieldOptions('["Red","Green","Blue"]')).toEqual([
      "Red",
      "Green",
      "Blue",
    ]);
  });

  it("trims JSON array entries and drops blanks and non-scalar entries", () => {
    expect(
      parseCustomFieldOptions('[" A ","",null,{"x":1},["y"],7,true]'),
    ).toEqual(["A", "7"]);
  });

  it("reads a comma-separated string", () => {
    expect(parseCustomFieldOptions("Red, Green ,Blue")).toEqual([
      "Red",
      "Green",
      "Blue",
    ]);
  });

  it("drops empty entries in a comma-separated string", () => {
    expect(parseCustomFieldOptions("Red,, ,Blue,")).toEqual(["Red", "Blue"]);
  });

  it.each([null, undefined, "", "   "])(
    "returns an empty list for %j",
    (raw) => {
      expect(parseCustomFieldOptions(raw)).toEqual([]);
    },
  );

  it("falls back to the comma-separated format for malformed JSON", () => {
    expect(parseCustomFieldOptions('["Red", "Green"')).toEqual([
      '["Red"',
      '"Green"',
    ]);
    expect(parseCustomFieldOptions("[not json")).toEqual(["[not json"]);
  });

  it("treats valid JSON that is not an array as a plain value", () => {
    expect(parseCustomFieldOptions("5")).toEqual(["5"]);
    expect(parseCustomFieldOptions('{"a":1}')).toEqual(['{"a":1}']);
    expect(parseCustomFieldOptions("null")).toEqual(["null"]);
  });

  it("never throws", () => {
    for (const raw of ['{"', "]", "\u0000", '["a",', "[[["]) {
      expect(() => parseCustomFieldOptions(raw)).not.toThrow();
    }
  });
});

describe("custom field options round trip", () => {
  const base = { name: "Colour", fieldType: "select", entityType: "asset" };

  it("keeps the options of an unchanged edit", () => {
    // What the admin form sends on create: a string array.
    const created = createCustomFieldDefinitionSchema.parse({
      ...base,
      options: ["Red", "Green", "Blue"],
    });

    // What the API stores and returns, shown in the edit form and resent.
    const editFormText = parseCustomFieldOptions(created.options).join(", ");
    const resent = createCustomFieldDefinitionSchema.parse({
      ...base,
      options: editFormText.split(",").map((o) => o.trim()),
    });

    expect(editFormText).toBe("Red, Green, Blue");
    expect(parseCustomFieldOptions(resent.options)).toEqual([
      "Red",
      "Green",
      "Blue",
    ]);
  });

  it("round-trips a legacy comma-separated column value", () => {
    const stored = "Small, Medium, Large";
    const resent = createCustomFieldDefinitionSchema.parse({
      ...base,
      options: parseCustomFieldOptions(stored),
    });

    expect(parseCustomFieldOptions(resent.options)).toEqual([
      "Small",
      "Medium",
      "Large",
    ]);
  });
});
