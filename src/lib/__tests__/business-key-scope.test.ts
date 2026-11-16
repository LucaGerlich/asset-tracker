import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const schema = readFileSync(
  path.resolve(__dirname, "../../../prisma/schema.prisma"),
  "utf8",
);

function modelBlock(name: string): string {
  const match = schema.match(
    new RegExp(`^model ${name} \\{[\\s\\S]*?^\\}`, "m"),
  );
  if (!match) throw new Error(`model ${name} not found`);
  return match[0];
}

describe.each([
  ["PurchaseOrder", "poNumber"],
  ["licence", "licencekey"],
])("%s.%s uniqueness", (modelName, field) => {
  const block = modelBlock(modelName);

  it("is not globally unique (cross-tenant existence oracle / collision)", () => {
    const line = block
      .split("\n")
      .find((l) => new RegExp(`^\\s*${field}\\s`).test(l));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/@unique/);
  });

  it("is unique per organization", () => {
    expect(block).toContain(`@@unique([organizationId, ${field}])`);
  });
});
