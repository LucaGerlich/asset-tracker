import { describe, it, expect } from "vitest";
import {
  ALLOWED_SETTING_KEYS,
  MASKED_VALUE,
  isMaskedValue,
  partitionSettingKeys,
  settingsPayloadSchema,
  type SettingsGroup,
} from "@/lib/settings-keys";

const GROUPS = Object.keys(ALLOWED_SETTING_KEYS) as SettingsGroup[];

/** Keys that must never be writable through any of the four settings routes. */
const FORBIDDEN_KEYS = [
  "deployment.mode",
  "sso.token.abc",
  "scim.bearerToken",
  "freshdesk_api_key",
  "",
];

describe("ALLOWED_SETTING_KEYS", () => {
  it("covers exactly the four platform groups", () => {
    expect([...GROUPS].sort()).toEqual([
      "integrations",
      "intune",
      "ldap",
      "sso",
    ]);
  });

  it("allows the keys the SSO tab sends and lib/sso.ts reads", () => {
    expect([...ALLOWED_SETTING_KEYS.sso].sort()).toEqual(
      [
        "sso.enabled",
        "sso.provider",
        "sso.providerName",
        "sso.entityId",
        "sso.ssoUrl",
        "sso.sloUrl",
        "sso.certificate",
        "sso.signRequests",
        "sso.clientId",
        "sso.clientSecret",
        "sso.discoveryUrl",
        "sso.authorizationUrl",
        "sso.tokenUrl",
        "sso.scopes",
        "sso.attr.email",
        "sso.attr.firstName",
        "sso.attr.lastName",
        "sso.attr.username",
        "sso.attr.groups",
      ].sort(),
    );
  });

  it("allows the keys the LDAP tab sends and lib/ldap.ts reads", () => {
    expect([...ALLOWED_SETTING_KEYS.ldap].sort()).toEqual(
      [
        "ldap.enabled",
        "ldap.serverUrl",
        "ldap.port",
        "ldap.useTLS",
        "ldap.bindDN",
        "ldap.bindPassword",
        "ldap.searchBase",
        "ldap.userFilter",
        "ldap.groupFilter",
        "ldap.attr.username",
        "ldap.attr.email",
        "ldap.attr.firstName",
        "ldap.attr.lastName",
        "ldap.attr.groupMember",
        "ldap.syncEnabled",
        "ldap.syncInterval",
        "ldap.autoCreateUsers",
        "ldap.autoDeactivateUsers",
      ].sort(),
    );
  });

  it("allows the keys the Intune tab sends and lib/integrations/intune.ts reads", () => {
    expect([...ALLOWED_SETTING_KEYS.intune].sort()).toEqual(
      [
        "intune.enabled",
        "intune.tenantId",
        "intune.clientId",
        "intune.clientSecret",
        "intune.autoSync",
        "intune.autoCreateAssets",
        "intune.autoUpdateAssets",
      ].sort(),
    );
  });

  it("allows the keys the Integrations tab sends and slack-teams.ts reads", () => {
    expect([...ALLOWED_SETTING_KEYS.integrations].sort()).toEqual(
      [
        "integrations.slack.enabled",
        "integrations.slack.webhookUrl",
        "integrations.slack.channel",
        "integrations.slack.events",
        "integrations.teams.enabled",
        "integrations.teams.webhookUrl",
        "integrations.teams.events",
      ].sort(),
    );
  });

  it.each(GROUPS)("keeps every %s key inside its own namespace", (group) => {
    for (const key of ALLOWED_SETTING_KEYS[group]) {
      expect(key.startsWith(`${group}.`)).toBe(true);
    }
  });

  it("never lists a short-lived sso.token.* row", () => {
    for (const group of GROUPS) {
      for (const key of ALLOWED_SETTING_KEYS[group]) {
        expect(key.startsWith("sso.token.")).toBe(false);
      }
    }
  });
});

describe("partitionSettingKeys", () => {
  it("allows known keys and keeps their order", () => {
    expect(partitionSettingKeys("ldap", ["ldap.port", "ldap.enabled"])).toEqual(
      { allowed: ["ldap.port", "ldap.enabled"], rejected: [] },
    );
  });

  it.each(GROUPS)("rejects platform and credential keys for %s", (group) => {
    const result = partitionSettingKeys(group, FORBIDDEN_KEYS);

    expect(result.allowed).toEqual([]);
    expect(result.rejected).toEqual(FORBIDDEN_KEYS);
  });

  it("separates allowed from rejected keys in a mixed request", () => {
    const result = partitionSettingKeys("sso", [
      "sso.enabled",
      "deployment.mode",
      "sso.scopes",
      "sso.token.abc",
    ]);

    expect(result.allowed).toEqual(["sso.enabled", "sso.scopes"]);
    expect(result.rejected).toEqual(["deployment.mode", "sso.token.abc"]);
  });

  it("allows sso.tokenUrl but rejects sso.token.<id> (prefix lookalike)", () => {
    const result = partitionSettingKeys("sso", [
      "sso.tokenUrl",
      "sso.token.0f1e2d",
    ]);

    expect(result.allowed).toEqual(["sso.tokenUrl"]);
    expect(result.rejected).toEqual(["sso.token.0f1e2d"]);
  });

  it("rejects a key that belongs to another group", () => {
    expect(partitionSettingKeys("sso", ["ldap.enabled"]).rejected).toEqual([
      "ldap.enabled",
    ]);
    expect(
      partitionSettingKeys("integrations", ["intune.enabled"]).rejected,
    ).toEqual(["intune.enabled"]);
  });

  it("does not treat Object.prototype names as allowed keys", () => {
    const result = partitionSettingKeys("sso", ["__proto__", "constructor"]);

    expect(result.allowed).toEqual([]);
    expect(result.rejected).toEqual(["__proto__", "constructor"]);
  });

  it("handles an empty key list", () => {
    expect(partitionSettingKeys("intune", [])).toEqual({
      allowed: [],
      rejected: [],
    });
  });
});

describe("MASKED_VALUE", () => {
  it("is the eight-asterisk placeholder the GET routes and tabs use", () => {
    expect(MASKED_VALUE).toBe("********");
  });

  it("is recognised by isMaskedValue", () => {
    expect(isMaskedValue(MASKED_VALUE)).toBe(true);
  });

  it("does not flag real or empty values as masked", () => {
    expect(isMaskedValue("secret")).toBe(false);
    expect(isMaskedValue("")).toBe(false);
    expect(isMaskedValue(null)).toBe(false);
    expect(isMaskedValue("*******")).toBe(false);
    expect(isMaskedValue(` ${MASKED_VALUE}`)).toBe(false);
  });
});

describe("settingsPayloadSchema", () => {
  it("accepts string and null values", () => {
    const parsed = settingsPayloadSchema.safeParse({
      settings: [
        { key: "sso.enabled", value: "true" },
        { key: "sso.sloUrl", value: null },
      ],
    });

    expect(parsed.success).toBe(true);
  });

  it.each([
    ["a missing settings array", {}],
    ["a non-array settings field", { settings: "x" }],
    ["an entry without a key", { settings: [{ value: "x" }] }],
    ["a numeric value", { settings: [{ key: "sso.enabled", value: 1 }] }],
    ["an entry without a value", { settings: [{ key: "sso.enabled" }] }],
  ])("rejects %s", (_label, body) => {
    expect(settingsPayloadSchema.safeParse(body).success).toBe(false);
  });
});
