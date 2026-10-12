import { z } from "zod";

/**
 * Allow-lists for the platform settings routes (SSO, LDAP, Intune,
 * integrations).
 *
 * All four PUT routes upsert into the shared `system_settings` table by key.
 * Without an allow-list a caller could overwrite any row: `deployment.mode`,
 * the SCIM bearer token or the short-lived `sso.token.*` login rows. Each list
 * is the union of the keys the settings tab sends and the keys the matching
 * library reads. Adding a setting means adding its key here, and to the tests
 * that pin these literals.
 */

/** Placeholder the GET routes return in place of an encrypted value. */
export const MASKED_VALUE = "********";

export type SettingsGroup = "sso" | "ldap" | "intune" | "integrations";

export const ALLOWED_SETTING_KEYS: Record<
  SettingsGroup,
  ReadonlySet<string>
> = {
  // Tab: SSOSettingsTab.tsx. Reader: getSsoSettings() in lib/sso.ts.
  sso: new Set([
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
  ]),
  // Tab: LDAPSettingsTab.tsx. Reader: getLdapSettings() in lib/ldap.ts.
  ldap: new Set([
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
  ]),
  // Tab: IntuneSettingsTab.tsx. Reader: lib/integrations/intune.ts.
  intune: new Set([
    "intune.enabled",
    "intune.tenantId",
    "intune.clientId",
    "intune.clientSecret",
    "intune.autoSync",
    "intune.autoCreateAssets",
    "intune.autoUpdateAssets",
  ]),
  // Tab: IntegrationsTab.tsx. Reader: lib/integrations/slack-teams.ts.
  integrations: new Set([
    "integrations.slack.enabled",
    "integrations.slack.webhookUrl",
    "integrations.slack.channel",
    "integrations.slack.events",
    "integrations.teams.enabled",
    "integrations.teams.webhookUrl",
    "integrations.teams.events",
  ]),
};

export interface PartitionedSettingKeys {
  allowed: string[];
  rejected: string[];
}

/** Split requested keys into those the group may write and those it may not. */
export function partitionSettingKeys(
  group: SettingsGroup,
  keys: readonly string[],
): PartitionedSettingKeys {
  const allowList = ALLOWED_SETTING_KEYS[group];
  const allowed: string[] = [];
  const rejected: string[] = [];

  for (const key of keys) {
    (allowList.has(key) ? allowed : rejected).push(key);
  }

  return { allowed, rejected };
}

/** Whether the client echoed back the mask instead of entering a new value. */
export function isMaskedValue(value: string | null): boolean {
  return value === MASKED_VALUE;
}

/** Request body shared by the four settings PUT routes. */
export const settingsPayloadSchema = z.object({
  settings: z.array(
    z.object({
      key: z.string(),
      value: z.string().nullable(),
    }),
  ),
});
