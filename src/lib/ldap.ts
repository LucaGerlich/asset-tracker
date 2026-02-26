/**
 * LDAP / Active Directory integration
 *
 * Provides:
 *  - testConnection(): Verify LDAP server connectivity and bind credentials
 *  - syncUsers(): Import/update users from LDAP directory
 *  - authenticateUser(): Bind-authenticate a user for LDAP login
 */

import ldap from "ldapjs";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// Settings reader
// ---------------------------------------------------------------------------

export interface LdapSettings {
  enabled: boolean;
  serverUrl: string;
  port: number;
  useTLS: boolean;
  bindDN: string;
  bindPassword: string;
  searchBase: string;
  userFilter: string;
  groupFilter: string;
  attrUsername: string;
  attrEmail: string;
  attrFirstName: string;
  attrLastName: string;
  attrGroupMember: string;
  syncEnabled: boolean;
  syncInterval: number;
  autoCreateUsers: boolean;
  autoDeactivateUsers: boolean;
}

export async function getLdapSettings(): Promise<LdapSettings> {
  const rows = await prisma.system_settings.findMany({
    where: { settingKey: { startsWith: "ldap." } },
  });

  const get = (key: string, fallback = ""): string => {
    const row = rows.find((r) => r.settingKey === key);
    if (!row || !row.settingValue) return fallback;
    if (row.isEncrypted) return decrypt(row.settingValue);
    return row.settingValue;
  };

  return {
    enabled: get("ldap.enabled") === "true",
    serverUrl: get("ldap.serverUrl"),
    port: parseInt(get("ldap.port", "389"), 10),
    useTLS: get("ldap.useTLS") === "true",
    bindDN: get("ldap.bindDN"),
    bindPassword: get("ldap.bindPassword"),
    searchBase: get("ldap.searchBase"),
    userFilter: get("ldap.userFilter", "(objectClass=user)"),
    groupFilter: get("ldap.groupFilter", "(objectClass=group)"),
    attrUsername: get("ldap.attr.username", "sAMAccountName"),
    attrEmail: get("ldap.attr.email", "mail"),
    attrFirstName: get("ldap.attr.firstName", "givenName"),
    attrLastName: get("ldap.attr.lastName", "sn"),
    attrGroupMember: get("ldap.attr.groupMember", "memberOf"),
    syncEnabled: get("ldap.syncEnabled") === "true",
    syncInterval: parseInt(get("ldap.syncInterval", "60"), 10),
    autoCreateUsers: get("ldap.autoCreateUsers") !== "false",
    autoDeactivateUsers: get("ldap.autoDeactivateUsers") === "true",
  };
}

// ---------------------------------------------------------------------------
// LDAP client helpers
// ---------------------------------------------------------------------------

function createClient(settings: LdapSettings): ldap.Client {
  const url = settings.serverUrl.includes("://")
    ? settings.serverUrl
    : `ldap://${settings.serverUrl}:${settings.port}`;

  return ldap.createClient({
    url,
    tlsOptions: settings.useTLS ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10_000,
    timeout: 30_000,
  });
}

function bindAsync(client: ldap.Client, dn: string, password: string): Promise<void> {
  return new Promise((resolve, reject) => {
    client.bind(dn, password, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function unbindAsync(client: ldap.Client): Promise<void> {
  return new Promise((resolve) => {
    client.unbind(() => resolve());
  });
}

interface LdapEntry {
  dn: string;
  [key: string]: string | string[] | undefined;
}

function searchAsync(
  client: ldap.Client,
  base: string,
  opts: ldap.SearchOptions,
): Promise<LdapEntry[]> {
  return new Promise((resolve, reject) => {
    client.search(base, opts, (err, res) => {
      if (err) return reject(err);

      const entries: LdapEntry[] = [];

      res.on("searchEntry", (entry) => {
        const obj: LdapEntry = { dn: entry.dn.toString() };
        for (const attr of entry.attributes) {
          const vals = attr.values;
          obj[attr.type] = vals.length === 1 ? vals[0] : vals;
        }
        entries.push(obj);
      });

      res.on("error", (e) => reject(e));
      res.on("end", () => resolve(entries));
    });
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Test LDAP connection by binding with service account credentials.
 * Returns { success, message, userCount? }.
 */
export async function testConnection(settings?: LdapSettings): Promise<{
  success: boolean;
  message: string;
  userCount?: number;
}> {
  const cfg = settings || (await getLdapSettings());

  if (!cfg.serverUrl || !cfg.bindDN || !cfg.bindPassword) {
    return { success: false, message: "Missing required LDAP configuration" };
  }

  const client = createClient(cfg);

  try {
    await bindAsync(client, cfg.bindDN, cfg.bindPassword);

    // Try a search to verify searchBase is correct
    const users = await searchAsync(client, cfg.searchBase, {
      filter: cfg.userFilter,
      scope: "sub",
      attributes: [cfg.attrUsername],
      sizeLimit: 1000,
      timeLimit: 15,
    });

    await unbindAsync(client);

    return {
      success: true,
      message: `Connected successfully. Found ${users.length} user(s) matching filter.`,
      userCount: users.length,
    };
  } catch (err: any) {
    try { await unbindAsync(client); } catch { /* ignore */ }
    const msg = err.message || String(err);
    logger.error("LDAP test connection failed", { error: msg });
    return { success: false, message: `Connection failed: ${msg}` };
  }
}

/**
 * Sync users from LDAP directory.
 * Creates new users, updates existing, optionally deactivates missing.
 */
export async function syncUsers(
  organizationId?: string,
  triggeredBy: string = "manual",
): Promise<{
  success: boolean;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}> {
  const cfg = await getLdapSettings();
  const startTime = Date.now();
  const errors: string[] = [];
  let created = 0;
  let updated = 0;
  let deactivated = 0;

  if (!cfg.enabled) {
    return { success: false, created: 0, updated: 0, deactivated: 0, errors: ["LDAP is not enabled"] };
  }

  const client = createClient(cfg);

  try {
    await bindAsync(client, cfg.bindDN, cfg.bindPassword);

    const ldapUsers = await searchAsync(client, cfg.searchBase, {
      filter: cfg.userFilter,
      scope: "sub",
      attributes: [
        cfg.attrUsername,
        cfg.attrEmail,
        cfg.attrFirstName,
        cfg.attrLastName,
        "distinguishedName",
        "objectGUID",
        "userAccountControl",
      ],
      sizeLimit: 5000,
      timeLimit: 60,
    });

    await unbindAsync(client);

    // Track which external IDs we saw for deactivation
    const seenExternalIds = new Set<string>();

    for (const entry of ldapUsers) {
      try {
        const username = getAttr(entry, cfg.attrUsername);
        const email = getAttr(entry, cfg.attrEmail);
        const firstName = getAttr(entry, cfg.attrFirstName) || "Unknown";
        const lastName = getAttr(entry, cfg.attrLastName) || "Unknown";
        const dn = entry.dn;
        const externalId = getAttr(entry, "objectGUID") || dn;

        if (!username) {
          errors.push(`Entry ${dn}: missing username attribute`);
          continue;
        }

        seenExternalIds.add(externalId);

        // Check if user already exists by externalId or username
        const existingUser = await prisma.user.findFirst({
          where: {
            OR: [
              { externalId },
              { username },
            ],
          },
        });

        if (existingUser) {
          // Update existing user
          await prisma.user.update({
            where: { userid: existingUser.userid },
            data: {
              firstname: firstName,
              lastname: lastName,
              email: email || existingUser.email,
              ldapDN: dn,
              externalId,
              authProvider: "ldap",
              lastSyncedAt: new Date(),
              isActive: true,
              change_date: new Date(),
            },
          });
          updated++;
        } else if (cfg.autoCreateUsers) {
          // Create new user with random password (they'll auth via LDAP)
          const randomPassword = await bcrypt.hash(
            crypto.randomBytes(32).toString("hex"),
            10,
          );

          await prisma.user.create({
            data: {
              username,
              email: email || null,
              firstname: firstName,
              lastname: lastName,
              password: randomPassword,
              isadmin: false,
              canrequest: true,
              authProvider: "ldap",
              externalId,
              ldapDN: dn,
              lastSyncedAt: new Date(),
              isActive: true,
              organizationId: organizationId || null,
              creation_date: new Date(),
            },
          });
          created++;
        }
      } catch (err: any) {
        errors.push(`Entry ${entry.dn}: ${err.message}`);
      }
    }

    // Deactivate users not found in LDAP
    if (cfg.autoDeactivateUsers) {
      const ldapUsers = await prisma.user.findMany({
        where: {
          authProvider: "ldap",
          isActive: true,
          ...(organizationId ? { organizationId } : {}),
        },
        select: { userid: true, externalId: true, username: true },
      });

      for (const user of ldapUsers) {
        if (user.externalId && !seenExternalIds.has(user.externalId)) {
          await prisma.user.update({
            where: { userid: user.userid },
            data: { isActive: false, change_date: new Date() },
          });
          deactivated++;
        }
      }
    }

    // Log sync result
    const durationMs = Date.now() - startTime;
    await prisma.ldapSyncLog.create({
      data: {
        status: errors.length > 0 ? "partial" : "success",
        usersCreated: created,
        usersUpdated: updated,
        usersDeactivated: deactivated,
        errors: errors.length > 0 ? errors : undefined,
        triggeredBy,
        durationMs,
      },
    });

    return { success: true, created, updated, deactivated, errors };
  } catch (err: any) {
    try { await unbindAsync(client); } catch { /* ignore */ }

    const durationMs = Date.now() - startTime;
    await prisma.ldapSyncLog.create({
      data: {
        status: "failed",
        usersCreated: created,
        usersUpdated: updated,
        usersDeactivated: deactivated,
        errors: [err.message, ...errors],
        triggeredBy,
        durationMs,
      },
    });

    logger.error("LDAP sync failed", { error: err.message });
    return { success: false, created, updated, deactivated, errors: [err.message, ...errors] };
  }
}

/**
 * Authenticate a user against the LDAP directory via bind.
 * Returns the user's DN if successful, null otherwise.
 */
export async function authenticateUser(
  username: string,
  password: string,
): Promise<{ success: boolean; dn?: string }> {
  const cfg = await getLdapSettings();

  if (!cfg.enabled) {
    return { success: false };
  }

  const client = createClient(cfg);

  try {
    // First bind as service account to find the user's DN
    await bindAsync(client, cfg.bindDN, cfg.bindPassword);

    const searchFilter = `(&${cfg.userFilter}(${cfg.attrUsername}=${escapeFilter(username)}))`;

    const results = await searchAsync(client, cfg.searchBase, {
      filter: searchFilter,
      scope: "sub",
      attributes: ["dn", cfg.attrUsername],
      sizeLimit: 1,
    });

    if (results.length === 0) {
      await unbindAsync(client);
      return { success: false };
    }

    const userDN = results[0].dn;
    await unbindAsync(client);

    // Now bind as the user to verify their password
    const userClient = createClient(cfg);
    try {
      await bindAsync(userClient, userDN, password);
      await unbindAsync(userClient);
      return { success: true, dn: userDN };
    } catch {
      try { await unbindAsync(userClient); } catch { /* ignore */ }
      return { success: false };
    }
  } catch (err: any) {
    try { await unbindAsync(client); } catch { /* ignore */ }
    logger.error("LDAP authentication error", { error: err.message, username });
    return { success: false };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAttr(entry: LdapEntry, attr: string): string | undefined {
  const val = entry[attr];
  if (Array.isArray(val)) return val[0];
  return val;
}

/** Escape special characters in LDAP filter values (RFC 4515) */
function escapeFilter(value: string): string {
  return value.replace(/[\\*()]/g, (ch) => {
    return "\\" + ch.charCodeAt(0).toString(16).padStart(2, "0");
  });
}
