/**
 * SSO (SAML/OIDC) integration utilities
 *
 * Reads SSO configuration from system_settings and provides:
 *  - getSsoSettings(): Read SSO config
 *  - validateSamlResponse(): Validate SAML assertion
 *  - exchangeOidcCode(): Exchange OIDC auth code for user info
 */

import { SAML, type SamlConfig, type Profile } from "@node-saml/node-saml";
import { jwtVerify, createRemoteJWKSet } from "jose";
import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";

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

  const config: SamlConfig = {
    callbackUrl,
    entryPoint: settings.ssoUrl,
    issuer: settings.entityId || callbackUrl,
    idpCert: settings.certificate,
    wantAssertionsSigned: true,
    wantAuthnResponseSigned: false,
  };
  return new SAML(config);
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

  const attrs = profile as Profile;

  return {
    nameID: profile.nameID || "",
    email: String(attrs[settings.attrEmail] ?? profile.nameID),
    firstName: String(attrs[settings.attrFirstName] ?? ""),
    lastName: String(attrs[settings.attrLastName] ?? ""),
    username: String(attrs[settings.attrUsername] ?? profile.nameID),
    groups: settings.attrGroups
      ? (attrs[settings.attrGroups] as string[])
      : undefined,
  };
}

export interface OidcUserProfile {
  sub: string;
  email?: string;
  /**
   * Whether the IdP asserted `email_verified: true` on a signature-verified
   * ID token. Only claims backed by a verified JWT signature set this to
   * true — callers must not treat `email` as trustworthy for account
   * linking unless this is true.
   */
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  username?: string;
  groups?: string[];
}

/**
 * Cache of remote JWKS getters, keyed by jwks_uri. `createRemoteJWKSet`
 * already caches fetched keys internally, but caching the getter itself
 * avoids re-creating (and re-fetching) it on every login.
 */
const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getRemoteJwks(jwksUri: string): ReturnType<typeof createRemoteJWKSet> {
  let jwks = jwksCache.get(jwksUri);
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(jwksUri));
    jwksCache.set(jwksUri, jwks);
  }
  return jwks;
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
  let expectedIssuer: string | undefined;
  let jwksUri: string | undefined;

  if (settings.discoveryUrl) {
    const disco = await fetchOidcDiscovery(settings.discoveryUrl);
    tokenEndpoint = tokenEndpoint || disco.token_endpoint;
    userinfoEndpoint = disco.userinfo_endpoint;
    expectedIssuer = disco.issuer;
    jwksUri = disco.jwks_uri;
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

  // Verify the ID token's signature against the IdP's published JWKS, and
  // validate issuer/audience/expiry as part of that same check. A payload
  // that hasn't been signature-verified must never be trusted (CWE-347).
  let claims: Record<string, unknown> = {};
  let emailVerified = false;
  if (tokens.id_token) {
    if (!jwksUri) {
      throw new Error(
        "Cannot verify ID token signature: OIDC discovery is not configured or does not provide a jwks_uri",
      );
    }

    const { payload } = await jwtVerify(
      tokens.id_token,
      getRemoteJwks(jwksUri),
      {
        issuer: expectedIssuer,
        audience: settings.clientId,
      },
    );

    claims = payload as Record<string, unknown>;
    emailVerified = claims.email_verified === true;
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

  const str = (v: unknown): string => (typeof v === "string" ? v : "");

  return {
    sub: str(claims.sub) || str(claims.oid) || "",
    email: str(claims[settings.attrEmail]) || str(claims.email),
    emailVerified,
    firstName:
      str(claims[settings.attrFirstName]) || str(claims.given_name) || "",
    lastName:
      str(claims[settings.attrLastName]) || str(claims.family_name) || "",
    username:
      str(claims[settings.attrUsername]) ||
      str(claims.preferred_username) ||
      str(claims.email),
    groups: settings.attrGroups
      ? (claims[settings.attrGroups] as string[] | undefined)
      : undefined,
  };
}

interface OidcDiscovery {
  issuer?: string;
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
