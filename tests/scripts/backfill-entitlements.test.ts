import type { ClientBase } from "pg";
import { describe, it, expect, vi } from "vitest";
import { GATED_FEATURES } from "@/lib/entitlements-shared";
import {
  applyBackfill,
  currentAccessFor,
  parseBackfillArgs,
  planBackfill,
  storedEntitlementsValid,
  summarizeBackfill,
  type BackfillArgs,
  type BackfillRow,
} from "../../scripts/lib/backfill-entitlements";

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

describe("parseBackfillArgs", () => {
  const URL_5432 = "postgresql://u:s3cret@db.example.com:5432/app";
  const TARGET = "db.example.com:5432/app/public";
  const env = { DATABASE_URL: URL_5432 };
  const base = ["--schema", "public", "--deployment-self-hosted", "false"];

  it("defaults to a dry run and describes the target", () => {
    expect(parseBackfillArgs(base, env)).toEqual({
      connectionString: URL_5432,
      schema: "public",
      deploymentSelfHosted: false,
      apply: false,
      target: TARGET,
    });
  });

  it("accepts --dry-run as the explicit default", () => {
    expect(parseBackfillArgs([...base, "--dry-run"], env).apply).toBe(false);
  });

  it("reads --deployment-self-hosted true", () => {
    expect(
      parseBackfillArgs(
        ["--schema", "public", "--deployment-self-hosted", "true"],
        env,
      ).deploymentSelfHosted,
    ).toBe(true);
  });

  it("applies only with a --confirm that equals the target", () => {
    const parsed = parseBackfillArgs(
      [...base, "--apply", "--confirm", TARGET],
      env,
    );

    expect(parsed.apply).toBe(true);
    expect(parsed.target).toBe(TARGET);
  });

  it.each([
    ["no DATABASE_URL", base, {}, /DATABASE_URL is not set/],
    ["an empty DATABASE_URL", base, { DATABASE_URL: "" }, /DATABASE_URL/],
    [
      "no --schema",
      ["--deployment-self-hosted", "false"],
      env,
      /--schema is required/,
    ],
    [
      "an invalid --schema",
      ["--schema", "Public", "--deployment-self-hosted", "false"],
      env,
      /--schema is required/,
    ],
    [
      "no --deployment-self-hosted",
      ["--schema", "public"],
      env,
      /true or false/,
    ],
    [
      "an invalid --deployment-self-hosted",
      ["--schema", "public", "--deployment-self-hosted", "yes"],
      env,
      /true or false/,
    ],
    [
      "--apply with --dry-run",
      [...base, "--apply", "--dry-run", "--confirm", TARGET],
      env,
      /cannot be combined/,
    ],
    [
      "--confirm without --apply",
      [...base, "--confirm", TARGET],
      env,
      /only valid together with --apply/,
    ],
    [
      "--apply without --confirm",
      [...base, "--apply"],
      env,
      /requires --confirm/,
    ],
    [
      "--apply with a different --confirm",
      [...base, "--apply", "--confirm", "db.example.com:5432/app/assettool"],
      env,
      /requires --confirm "db\.example\.com:5432\/app\/public"/,
    ],
    [
      "--apply with a --confirm that is only a prefix of the target",
      [...base, "--apply", "--confirm", "db.example.com:5432/app"],
      env,
      /requires --confirm/,
    ],
    [
      "a DATABASE_URL that does not name its port",
      base,
      { DATABASE_URL: "postgresql://u:p@db.example.com/app" },
      /port explicitly/,
    ],
    ["an unknown option", [...base, "--force"], env, /Unknown option/],
    ["a positional argument", [...base, "extra"], env, /Unexpected argument/],
  ])("rejects %s", (_name, argv, environment, message) => {
    expect(() => parseBackfillArgs(argv, environment)).toThrow(message);
  });

  // Each call must throw (positive match) and the error must not hold the
  // password: `.not.toThrow(...)` alone also passes when nothing is thrown.
  it.each([
    [
      "--apply without --confirm",
      [...base, "--apply"],
      env,
      /requires --confirm/,
    ],
    [
      "--apply with a different --confirm",
      [...base, "--apply", "--confirm", "db.example.com:5432/app/assettool"],
      env,
      /requires --confirm/,
    ],
    [
      "a DATABASE_URL without a port",
      base,
      { DATABASE_URL: "postgresql://u:s3cret@db.example.com/app" },
      /port explicitly/,
    ],
    [
      "a DATABASE_URL with an overriding parameter",
      base,
      { DATABASE_URL: `${URL_5432}?host=other.example.com` },
      /"host" query parameter/,
    ],
  ])(
    "never puts credentials into the error for %s",
    (_name, argv, environment, message) => {
      const attempt = (): BackfillArgs => parseBackfillArgs(argv, environment);

      expect(attempt).toThrow(message);
      expect(attempt).not.toThrow(/s3cret/);
    },
  );
});

describe("storedEntitlementsValid", () => {
  it("is null when nothing is stored", () => {
    expect(storedEntitlementsValid(false, null)).toBeNull();
  });

  it("is true for a value that passes the strict schema", () => {
    expect(
      storedEntitlementsValid(true, {
        features: ["scim"],
        maxAssets: null,
        maxUsers: 5,
      }),
    ).toBe(true);
  });

  it.each([
    [
      "an unknown feature",
      { features: ["white_label"], maxAssets: 1, maxUsers: 1 },
    ],
    ["a missing limit", { features: [], maxAssets: 1 }],
    [
      "an unknown key",
      { features: [], maxAssets: 1, maxUsers: 1, extra: true },
    ],
    ["a negative limit", { features: [], maxAssets: -1, maxUsers: 1 }],
    ["a fractional limit", { features: [], maxAssets: 1.5, maxUsers: 1 }],
    ["an array", []],
    ["a string", "{}"],
  ])("is false for %s", (_name, stored) => {
    expect(storedEntitlementsValid(true, stored)).toBe(false);
  });
});

interface FakeOrgRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  maxAssets: number;
  maxUsers: number;
  entitlementsSet: boolean;
  stored: unknown;
  assets: number;
  users: number;
  activeUsers: number;
}

function fakeOrg(overrides: Partial<FakeOrgRow>): FakeOrgRow {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Org",
    slug: "org",
    plan: "starter",
    maxAssets: 100,
    maxUsers: 3,
    entitlementsSet: false,
    stored: null,
    assets: 0,
    users: 0,
    activeUsers: 0,
    ...overrides,
  };
}

function fakeClient(
  rows: readonly FakeOrgRow[],
  rowCount = 1,
): { client: ClientBase; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn().mockResolvedValue({ rows, rowCount });
  return { client: { query } as unknown as ClientBase, query };
}

const VALID_STORED = { features: ["scim"], maxAssets: 7, maxUsers: 7 };
const INVALID_STORED = { features: ["white_label"] };

describe("planBackfill", () => {
  it("keeps the legacy plan values it read and classifies stored values", async () => {
    const { client } = fakeClient([
      fakeOrg({ id: "00000000-0000-4000-8000-000000000001", slug: "unset" }),
      fakeOrg({
        id: "00000000-0000-4000-8000-000000000002",
        slug: "valid",
        plan: "professional",
        maxAssets: 5000,
        maxUsers: 25,
        entitlementsSet: true,
        stored: VALID_STORED,
      }),
      fakeOrg({
        id: "00000000-0000-4000-8000-000000000003",
        slug: "invalid",
        entitlementsSet: true,
        stored: INVALID_STORED,
      }),
    ]);

    const rows = await planBackfill(client, "public", {
      deploymentSelfHosted: false,
    });

    expect(
      rows.map((row) => [
        row.slug,
        row.plan,
        row.maxAssets,
        row.maxUsers,
        row.entitlementsSet,
        row.storedValid,
      ]),
    ).toEqual([
      ["unset", "starter", 100, 3, false, null],
      ["valid", "professional", 5000, 25, true, true],
      ["invalid", "starter", 100, 3, true, false],
    ]);
  });
});

describe("summarizeBackfill", () => {
  it("counts unset and invalid rows separately, in the order the gate reads them", async () => {
    const { client } = fakeClient([
      fakeOrg({ id: "00000000-0000-4000-8000-000000000001", slug: "unset" }),
      fakeOrg({
        id: "00000000-0000-4000-8000-000000000002",
        slug: "valid",
        entitlementsSet: true,
        stored: VALID_STORED,
      }),
      fakeOrg({
        id: "00000000-0000-4000-8000-000000000003",
        slug: "invalid",
        plan: "gold",
        entitlementsSet: true,
        stored: INVALID_STORED,
      }),
    ]);
    const rows = await planBackfill(client, "public", {
      deploymentSelfHosted: false,
    });

    const summary = summarizeBackfill(rows);

    expect(summary).toMatchObject({
      organizations: 3,
      unset: 1,
      invalid: 1,
      unknownPlans: ["invalid"],
    });
    expect(Object.keys(summary)).toEqual([
      "organizations",
      "unset",
      "invalid",
      "losingFeatures",
      "overLimit",
      "unknownPlans",
    ]);
  });

  it("reports no unset and no invalid rows when everything is stored and valid", async () => {
    const { client } = fakeClient([
      fakeOrg({ entitlementsSet: true, stored: VALID_STORED }),
    ]);
    const rows = await planBackfill(client, "public", {
      deploymentSelfHosted: false,
    });

    expect(summarizeBackfill(rows)).toMatchObject({ unset: 0, invalid: 0 });
  });
});

describe("applyBackfill", () => {
  async function plannedRows(
    orgs: readonly FakeOrgRow[],
  ): Promise<BackfillRow[]> {
    return planBackfill(fakeClient(orgs).client, "public", {
      deploymentSelfHosted: false,
    });
  }

  it("guards the update with the plan values it read while planning", async () => {
    const rows = await plannedRows([
      fakeOrg({ plan: "professional", maxAssets: 5000, maxUsers: 25 }),
    ]);
    const { client, query } = fakeClient([]);

    await applyBackfill(client, "public", rows);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/"plan" = \$3/);
    expect(sql).toMatch(/"maxAssets" = \$4/);
    expect(sql).toMatch(/"maxUsers" = \$5/);
    expect(params).toEqual([
      JSON.stringify(rows[0].proposed),
      rows[0].id,
      "professional",
      5000,
      25,
    ]);
  });

  it("counts only the rows the update changed", async () => {
    const rows = await plannedRows([fakeOrg({})]);

    expect(await applyBackfill(fakeClient([], 1).client, "public", rows)).toBe(
      1,
    );
    expect(await applyBackfill(fakeClient([], 0).client, "public", rows)).toBe(
      0,
    );
  });

  it("never updates a row with a stored value, valid or not", async () => {
    const rows = await plannedRows([
      fakeOrg({ entitlementsSet: true, stored: VALID_STORED }),
      fakeOrg({ entitlementsSet: true, stored: INVALID_STORED }),
    ]);
    const { client, query } = fakeClient([]);

    expect(await applyBackfill(client, "public", rows)).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});
