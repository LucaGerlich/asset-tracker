import { describe, it, expect } from "vitest";
import { GATED_FEATURES } from "@/lib/entitlements-shared";
import {
  currentAccessFor,
  parseBackfillArgs,
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

  it("never puts credentials into an error message", () => {
    expect(() => parseBackfillArgs([...base, "--apply"], env)).not.toThrow(
      /s3cret/,
    );
  });
});
