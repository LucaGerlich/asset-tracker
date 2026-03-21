/**
 * SSO (SAML/OIDC) integration utilities
 *
 * Reads SSO configuration from system_settings and provides:
 *  - getSsoSettings(): Read SSO config
 *  - validateSamlResponse(): Validate SAML assertion
 *  - exchangeOidcCode(): Exchange OIDC auth code for user info
 */

import { SAML } from "@node-saml/node-saml";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

// ---------------------------------------------------------------------------
// Settings reader
// ---------------------------------------------------------------------------

export interface SsoSettings {
  enabled: boolean;
  provider: "saml" | "oidc";
  providerName: string;
  // SAML
  entityId: string;
  ssoUrl: string;
  sloUrl: string;
  certificate: string;
  signRequests: boolean;
  // OIDC
  clientId: string;
  clientSecret: string;
  discoveryUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string;
  // Attribute mapping
  attrEmail: string;
  attrFirstName: string;
  attrLastName: string;
  attrUsername: string;
  attrGroups: string;
}

export async function getSsoSettings(): Promise<SsoSettings> {
  const rows = await prisma.system_settings.findMany({
    where: { settingKey: { startsWith: "sso." } },
  });

  const get = (key: string, fallback = ""): string => {
    const row = rows.find((r) => r.settingKey === key);
    if (!row || !row.settingValue) return fallback;
    if (row.isEncrypted) return decrypt(row.settingValue);
    return row.settingValue;
  };

  return {
    enabled: get("sso.enabled") === "true",
    provider: (get("sso.provider") as "saml" | "oidc") || "saml",
    providerName: get("sso.providerName"),
    entityId: get("sso.entityId"),
    ssoUrl: get("sso.ssoUrl"),
    sloUrl: get("sso.sloUrl"),
    certificate: get("sso.certificate"),
    signRequests: get("sso.signRequests") === "true",
    clientId: get("sso.clientId"),
    clientSecret: get("sso.clientSecret"),
    discoveryUrl: get("sso.discoveryUrl"),
    authorizationUrl: get("sso.authorizationUrl"),
    tokenUrl: get("sso.tokenUrl"),
    scopes: get("sso.scopes", "openid profile email"),
    attrEmail: get("sso.attr.email", "email"),
    attrFirstName: get("sso.attr.firstName", "firstName"),
    attrLastName: get("sso.attr.lastName", "lastName"),
    attrUsername: get("sso.attr.username", "username"),
    attrGroups: get("sso.attr.groups"),
  };
}

// ---------------------------------------------------------------------------
// SAML
// ---------------------------------------------------------------------------

export interface SamlUserProfile {
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  nameID: string;
  groups?: string[];
}

/**
 * Create SAML instance from stored settings.
 */
function createSamlInstance(settings: SsoSettings): SAML {
  const callbackUrl = `${getBaseUrl()}/api/auth/callback/saml`;

  return new SAML({
    callbackUrl,
    entryPoint: settings.ssoUrl,
    issuer: settings.entityId || callbackUrl,
    idpCert: settings.certificate,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
  } as any);
}

/**
 * Generate SAML login URL for redirect.
 */
export async function getSamlLoginUrl(): Promise<string> {
  const settings = await getSsoSettings();
  if (!settings.enabled || settings.provider !== "saml") {
    throw new Error("SAML SSO is not enabled");
  }

  const saml = createSamlInstance(settings);
  const url = await saml.getAuthorizeUrlAsync("", undefined, {});
  return url;
}

/**
 * Validate a SAML response and extract user profile.
 */
export async function validateSamlResponse(body: {
  SAMLResponse: string;
}): Promise<SamlUserProfile> {
  const settings = await getSsoSettings();
  if (!settings.enabled || settings.provider !== "saml") {
    throw new Error("SAML SSO is not enabled");
  }

  const saml = createSamlInstance(settings);
  const { profile } = await saml.validatePostResponseAsync(body);

  if (!profile) {
    throw new Error("Invalid SAML response - no profile returned");
  }

  const attrs = (profile as any) || {};

  return {
    nameID: profile.nameID || "",
    email: attrs[settings.attrEmail] || profile.nameID,
    firstName: attrs[settings.attrFirstName] || "",
    lastName: attrs[settings.attrLastName] || "",
    username: attrs[settings.attrUsername] || profile.nameID,
    groups: settings.attrGroups
      ? (attrs[settings.attrGroups] as string[])
      : undefined,
  };
}

// ---------------------------------------------------------------------------
// OIDC
// ---------------------------------------------------------------------------

export interface OidcUserProfile {
  sub: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  username?: string;
  groups?: string[];
}

/**
 * Build OIDC authorization URL for redirect.
 */
export async function getOidcAuthorizationUrl(state: string): Promise<string> {
  const settings = await getSsoSettings();
  if (!settings.enabled || settings.provider !== "oidc") {
    throw new Error("OIDC SSO is not enabled");
  }

  let authUrl = settings.authorizationUrl;

  // If discovery URL is set, fetch authorization endpoint
  if (!authUrl && settings.discoveryUrl) {
    const disco = await fetchOidcDiscovery(settings.discoveryUrl);
    authUrl = disco.authorization_endpoint;
  }

  if (!authUrl) {
    throw new Error("No authorization URL configured");
  }

  const callbackUrl = `${getBaseUrl()}/api/auth/callback/oidc`;

  const params = new URLSearchParams({
    client_id: settings.clientId,
    redirect_uri: callbackUrl,
    response_type: "code",
    scope: settings.scopes,
    state,
  });

  return `${authUrl}?${params.toString()}`;
}

/**
 * Exchange OIDC authorization code for tokens and extract user profile.
 */
export async function exchangeOidcCode(code: string): Promise<OidcUserProfile> {
  const settings = await getSsoSettings();
  if (!settings.enabled || settings.provider !== "oidc") {
    throw new Error("OIDC SSO is not enabled");
  }

  let tokenEndpoint = settings.tokenUrl;
  let userinfoEndpoint: string | undefined;

  if (settings.discoveryUrl) {
    const disco = await fetchOidcDiscovery(settings.discoveryUrl);
    tokenEndpoint = tokenEndpoint || disco.token_endpoint;
    userinfoEndpoint = disco.userinfo_endpoint;
  }

  if (!tokenEndpoint) {
    throw new Error("No token URL configured");
  }

  const callbackUrl = `${getBaseUrl()}/api/auth/callback/oidc`;

  // Exchange code for tokens
  const tokenRes = await fetch(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: callbackUrl,
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokens = await tokenRes.json();

  // Decode ID token (basic JWT decode — signature validated by OIDC provider)
  let claims: any = {};
  if (tokens.id_token) {
    const parts = tokens.id_token.split(".");
    if (parts.length === 3) {
      claims = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    }
  }

  // Optionally fetch userinfo for more claims
  if (userinfoEndpoint && tokens.access_token) {
    try {
      const uiRes = await fetch(userinfoEndpoint, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (uiRes.ok) {
        const userinfo = await uiRes.json();
        claims = { ...claims, ...userinfo };
      }
    } catch (err) {
      logger.warn("Failed to fetch OIDC userinfo", { error: err });
    }
  }

  return {
    sub: claims.sub || claims.oid || "",
    email: claims[settings.attrEmail] || claims.email,
    firstName: claims[settings.attrFirstName] || claims.given_name || "",
    lastName: claims[settings.attrLastName] || claims.family_name || "",
    username:
      claims[settings.attrUsername] ||
      claims.preferred_username ||
      claims.email,
    groups: settings.attrGroups ? claims[settings.attrGroups] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface OidcDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
}

async function fetchOidcDiscovery(url: string): Promise<OidcDiscovery> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OIDC discovery failed: ${res.status}`);
  return res.json();
}
