import type { ClientBase } from "pg";
import { describe, it, expect, vi } from "vitest";
import {
  assertColumns,
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

  it("prints the decoded database name", () => {
    expect(
      describeTarget("postgres://u:p@localhost:5432/my%20app", "assettool"),
    ).toBe("localhost:5432/my app/assettool");
  });

  it("prints the decoded host, as pg connects to it", () => {
    expect(
      describeTarget("postgres://u:p@%61.example.com:5432/app", "public"),
    ).toBe("a.example.com:5432/app/public");
  });

  it("rejects a URL without a port, which pg would take from PGPORT", () => {
    expect(() =>
      describeTarget("postgres://u:p@localhost/app", "assettool"),
    ).toThrow(/port explicitly/);
  });

  it("rejects an empty host, which pg would take from PGHOST or localhost", () => {
    expect(() => describeTarget("postgresql:///app", "public")).toThrow(
      /host explicitly/,
    );
  });

  it.each(["postgresql://u:p@/app", "postgresql://u:p@:5432/app"])(
    "rejects credentials without a host: %s",
    (url) => {
      expect(() => describeTarget(url, "public")).toThrow();
    },
  );

  it.each(["postgres://u:p@localhost:5432", "postgres://u:p@localhost:5432/"])(
    "rejects a missing database: %s",
    (url) => {
      expect(() => describeTarget(url, "public")).toThrow(
        /database explicitly/,
      );
    },
  );

  it.each(["host", "hostaddr", "port", "dbname", "service"])(
    "rejects the %s query parameter, which overrides the URL",
    (param) => {
      expect(() =>
        describeTarget(
          `postgres://u:p@a.example.com:5432/app?${param}=other`,
          "public",
        ),
      ).toThrow(new RegExp(`"${param}" query parameter`));
    },
  );

  it("rejects an overriding parameter whatever its case", () => {
    expect(() =>
      describeTarget("postgres://u:p@a.example.com:5432/app?HOST=b", "public"),
    ).toThrow(/"HOST" query parameter/);
  });

  it("keeps other query parameters", () => {
    expect(
      describeTarget(
        "postgres://u:p@a.example.com:5432/app?sslmode=require&connect_timeout=5",
        "public",
      ),
    ).toBe("a.example.com:5432/app/public");
  });

  it("rejects an encoded reserved character that pg would decode differently", () => {
    expect(() =>
      describeTarget("postgres://u:p@a.example.com:5432/my%2Fapp", "public"),
    ).toThrow(/encoded reserved characters/);
  });

  it("rejects a malformed percent escape that ends the string", () => {
    expect(() =>
      describeTarget("postgres://u:p@a.example.com:5432/my%", "public"),
    ).toThrow(/malformed database name/);
  });

  it("rejects a malformed percent escape inside the database name", () => {
    expect(() =>
      describeTarget("postgres://u:p@a.example.com:5432/my%zzapp", "public"),
    ).toThrow(/percent escapes/);
  });

  it.each([
    "socket://u:p@a.example.com:5432/app?db=other",
    "http://u:p@a.example.com:5432/app",
    "mysql://u:p@a.example.com:5432/app",
  ])("rejects a scheme other than postgres or postgresql: %s", (url) => {
    expect(() => describeTarget(url, "public")).toThrow(
      /postgres: or postgresql: scheme/,
    );
  });

  it.each(["postgres", "postgresql", "POSTGRESQL"])(
    "accepts the %s scheme",
    (scheme) => {
      expect(
        describeTarget(`${scheme}://u:p@a.example.com:5432/app`, "public"),
      ).toBe("a.example.com:5432/app/public");
    },
  );

  it("keeps a well-formed percent escape in the database, as pg does", () => {
    expect(
      describeTarget("postgres://u:p@h.example.com:5432/my%2Dapp", "public"),
    ).toBe("h.example.com:5432/my-app/public");
  });

  // pg-connection-string re-encodes the whole string with encodeURI when it
  // holds a space or a malformed escape, which turns every "%" into "%25": the
  // database below would then be the literal name my%2Dapp, not my-app.
  it("rejects a percent escape in the database when another escape is malformed", () => {
    const attempt = (): string =>
      describeTarget("postgres://u:p%ss@h.example.com:5432/my%2Dapp", "public");
    expect(attempt).toThrow(/percent escapes/);
    expect(attempt).not.toThrow(/p%ss/);
  });

  it("rejects a percent escape in the host when another escape is malformed", () => {
    expect(() =>
      describeTarget("postgres://u:p%ss@a%2Dc.example.com:5432/app", "public"),
    ).toThrow(/percent escapes/);
  });

  it("rejects a percent escape in the database when the string holds a space", () => {
    expect(() =>
      describeTarget("postgres://u:p ss@h.example.com:5432/my%2Dapp", "public"),
    ).toThrow(/percent escapes/);
  });

  it("accepts a stray percent sign in the password, which never reaches the target", () => {
    expect(
      describeTarget("postgres://u:p%ss@h.example.com:5432/app", "public"),
    ).toBe("h.example.com:5432/app/public");
  });

  it("accepts a space in the password", () => {
    expect(
      describeTarget("postgres://u:p ss@h.example.com:5432/app", "public"),
    ).toBe("h.example.com:5432/app/public");
  });

  it("rejects an invalid URL without echoing its credentials", () => {
    const attempt = (): string =>
      describeTarget("postgres://admin:s3cret@exa mple.com:5432/app", "public");
    expect(attempt).toThrow(/not a valid URL/);
    expect(attempt).not.toThrow(/s3cret/);
  });
});

describe("qualified", () => {
  it("quotes schema and table", () => {
    expect(qualified("public", "organizations")).toBe(
      '"public"."organizations"',
    );
  });

  it.each(['a"b', "Public", "a.b", ""])("rejects the schema %j", (schema) => {
    expect(() => qualified(schema, "organizations")).toThrow();
  });
});

describe("assertColumns", () => {
  function clientWithColumns(columns: readonly string[]): {
    client: ClientBase;
    query: ReturnType<typeof vi.fn>;
  } {
    const query = vi.fn().mockResolvedValue({
      rows: columns.map((column_name) => ({ column_name })),
    });
    return { client: { query } as unknown as ClientBase, query };
  }

  it("resolves when every column is present", async () => {
    const { client, query } = clientWithColumns(["id", "plan", "extra"]);

    await expect(
      assertColumns(client, "assettool", "organizations", ["id", "plan"]),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledWith(expect.any(String), [
      "assettool",
      "organizations",
    ]);
  });

  it("names the missing columns and points at the migration", async () => {
    const { client } = clientWithColumns(["id"]);

    const failure = assertColumns(client, "public", "organizations", [
      "id",
      "entitlements",
      "createdAt",
    ]);

    await expect(failure).rejects.toThrow(
      /public\.organizations is missing entitlements, createdAt/,
    );
    await expect(failure).rejects.toThrow(/migration has not been applied/);
  });

  it("treats a schema without the table as all columns missing", async () => {
    const { client } = clientWithColumns([]);

    await expect(
      assertColumns(client, "public", "organizations", ["id"]),
    ).rejects.toThrow(/is missing id/);
  });
});
