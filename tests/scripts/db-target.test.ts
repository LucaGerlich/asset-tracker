import { describe, it, expect } from "vitest";
import {
  describeTarget,
  parseSchemaName,
  qualified,
} from "../../scripts/lib/db-target";

describe("parseSchemaName", () => {
  it.each(["public", "assettool", "_x1"])("accepts %s", (name) => {
    expect(parseSchemaName(name)).toBe(name);
  });

  it.each([undefined, "", "Public", 'a"b', "a.b", "1abc", "x".repeat(64)])(
    "rejects %s",
    (name) => {
      expect(() => parseSchemaName(name)).toThrow();
    },
  );
});

describe("describeTarget", () => {
  it("names host, port, database and schema without credentials", () => {
    expect(
      describeTarget(
        "postgresql://admin:s3cret@db.example.com:6543/postgres?sslmode=require",
        "public",
      ),
    ).toBe("db.example.com:6543/postgres/public");
  });

  it("defaults the port to 5432", () => {
    expect(describeTarget("postgres://u:p@localhost/app", "assettool")).toBe(
      "localhost:5432/app/assettool",
    );
  });
});

describe("qualified", () => {
  it("quotes schema and table", () => {
    expect(qualified("public", "organizations")).toBe(
      '"public"."organizations"',
    );
  });
});
