import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: { system_settings: { findMany: vi.fn() } },
}));
vi.mock("@/lib/encryption", () => ({
  decrypt: vi.fn((val: string) => `decrypted_${val}`),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@node-saml/node-saml", () => ({
  SAML: vi.fn().mockImplementation(() => ({
    getAuthorizeUrlAsync: vi
      .fn()
      .mockResolvedValue("https://idp.example.com/saml/login?SAMLRequest=xxx"),
    validatePostResponseAsync: vi.fn().mockResolvedValue({
      profile: {
        nameID: "jdoe@example.com",
        email: "jdoe@example.com",
        firstName: "John",
        lastName: "Doe",
      },
    }),
  })),
}));
vi.mock("jose", () => ({
  jwtVerify: vi.fn(),
  createRemoteJWKSet: vi.fn(),
}));

import prisma from "@/lib/prisma";
import { jwtVerify, createRemoteJWKSet } from "jose";
import {
  getSsoSettings,
  getSamlLoginUrl,
  getOidcAuthorizationUrl,
  exchangeOidcCode,
} from "@/lib/sso";

const mockPrisma = vi.mocked(prisma);

function mockSsoSettings(
  overrides: Array<{ key: string; value: string; encrypted?: boolean }>,
) {
  mockPrisma.system_settings.findMany.mockResolvedValue(
    overrides.map((o, i) => ({
      id: String(i),
      settingKey: o.key,
      settingValue: o.value,
      settingType: "string",
      category: "sso",
      isEncrypted: o.encrypted || false,
      updatedAt: new Date(),
    })) as any,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// getSsoSettings
// ---------------------------------------------------------------------------
describe("getSsoSettings", () => {
  it("returns defaults when no settings exist", async () => {
    mockPrisma.system_settings.findMany.mockResolvedValue([]);

    const settings = await getSsoSettings();

    expect(settings.enabled).toBe(false);
    expect(settings.provider).toBe("saml");
    expect(settings.scopes).toBe("openid profile email");
    expect(settings.attrEmail).toBe("email");
    expect(settings.attrFirstName).toBe("firstName");
    expect(settings.attrLastName).toBe("lastName");
    expect(settings.attrUsername).toBe("username");
  });

  it("reads and returns correct values from DB", async () => {
    mockSsoSettings([
      { key: "sso.enabled", value: "true" },
      { key: "sso.provider", value: "oidc" },
      { key: "sso.providerName", value: "Okta" },
      { key: "sso.clientId", value: "my-client-id" },
      {
        key: "sso.authorizationUrl",
        value: "https://okta.example.com/authorize",
      },
      { key: "sso.tokenUrl", value: "https://okta.example.com/token" },
      { key: "sso.scopes", value: "openid email" },
    ]);

    const settings = await getSsoSettings();

    expect(settings.enabled).toBe(true);
    expect(settings.provider).toBe("oidc");
    expect(settings.providerName).toBe("Okta");
    expect(settings.clientId).toBe("my-client-id");
    expect(settings.authorizationUrl).toBe(
      "https://okta.example.com/authorize",
    );
    expect(settings.scopes).toBe("openid email");
  });

  it("decrypts encrypted values", async () => {
    mockSsoSettings([
      { key: "sso.clientSecret", value: "enc_secret_123", encrypted: true },
      { key: "sso.certificate", value: "enc_cert_456", encrypted: true },
    ]);

    const settings = await getSsoSettings();

    expect(settings.clientSecret).toBe("decrypted_enc_secret_123");
    expect(settings.certificate).toBe("decrypted_enc_cert_456");
  });
});

// ---------------------------------------------------------------------------
// getSamlLoginUrl
// ---------------------------------------------------------------------------
describe("getSamlLoginUrl", () => {
  it("throws when SSO is not enabled", async () => {
    mockSsoSettings([
      { key: "sso.enabled", value: "false" },
      { key: "sso.provider", value: "saml" },
    ]);

    await expect(getSamlLoginUrl()).rejects.toThrow("SAML SSO is not enabled");
  });
});

// ---------------------------------------------------------------------------
// getOidcAuthorizationUrl
// ---------------------------------------------------------------------------
describe("getOidcAuthorizationUrl", () => {
  it("builds correct URL with query params", async () => {
    mockSsoSettings([
      { key: "sso.enabled", value: "true" },
      { key: "sso.provider", value: "oidc" },
      { key: "sso.clientId", value: "client-abc" },
      {
        key: "sso.authorizationUrl",
        value: "https://idp.example.com/authorize",
      },
      { key: "sso.scopes", value: "openid profile email" },
    ]);

    const url = await getOidcAuthorizationUrl("state-xyz");
    const parsed = new URL(url);

    expect(parsed.origin).toBe("https://idp.example.com");
    expect(parsed.pathname).toBe("/authorize");
    expect(parsed.searchParams.get("client_id")).toBe("client-abc");
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("scope")).toBe("openid profile email");
    expect(parsed.searchParams.get("state")).toBe("state-xyz");
    expect(parsed.searchParams.get("redirect_uri")).toContain(
      "/api/auth/callback/oidc",
    );
  });

  it("throws when OIDC is not enabled", async () => {
    mockSsoSettings([
      { key: "sso.enabled", value: "true" },
      { key: "sso.provider", value: "saml" },
    ]);

    await expect(getOidcAuthorizationUrl("state-xyz")).rejects.toThrow(
      "OIDC SSO is not enabled",
    );
  });
});

// ---------------------------------------------------------------------------
// exchangeOidcCode
// ---------------------------------------------------------------------------
describe("exchangeOidcCode", () => {
  const originalFetch = global.fetch;

  const baseSettings = [
    { key: "sso.enabled", value: "true" },
    { key: "sso.provider", value: "oidc" },
    { key: "sso.clientId", value: "client-abc" },
    { key: "sso.clientSecret", value: "secret-xyz" },
    {
      key: "sso.discoveryUrl",
      value: "https://idp.example.com/.well-known/openid-configuration",
    },
  ];

  const discoveryResponse = {
    issuer: "https://idp.example.com",
    authorization_endpoint: "https://idp.example.com/authorize",
    token_endpoint: "https://idp.example.com/token",
    jwks_uri: "https://idp.example.com/jwks",
  };

  const tokenResponse = {
    access_token: "at-123",
    id_token: "header.payload.signature",
  };

  beforeEach(() => {
    vi.mocked(createRemoteJWKSet).mockReturnValue(vi.fn() as any);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("verifies the ID token signature via the discovered JWKS and returns the claims", async () => {
    mockSsoSettings(baseSettings);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    vi.mocked(jwtVerify).mockResolvedValue({
      payload: {
        sub: "user-123",
        email: "jdoe@example.com",
        email_verified: true,
        given_name: "John",
        family_name: "Doe",
      },
      protectedHeader: { alg: "RS256" },
      key: undefined,
    } as any);

    const profile = await exchangeOidcCode("auth-code");

    expect(vi.mocked(createRemoteJWKSet)).toHaveBeenCalledWith(
      new URL("https://idp.example.com/jwks"),
    );
    expect(vi.mocked(jwtVerify)).toHaveBeenCalledWith(
      "header.payload.signature",
      expect.anything(),
      expect.objectContaining({
        issuer: "https://idp.example.com",
        audience: "client-abc",
      }),
    );
    expect(profile.sub).toBe("user-123");
    expect(profile.email).toBe("jdoe@example.com");
    expect(profile.emailVerified).toBe(true);
    expect(profile.firstName).toBe("John");
    expect(profile.lastName).toBe("Doe");
  });

  it("throws when ID token signature verification fails", async () => {
    mockSsoSettings(baseSettings);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => discoveryResponse,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    vi.mocked(jwtVerify).mockRejectedValue(
      new Error("signature verification failed"),
    );

    await expect(exchangeOidcCode("auth-code")).rejects.toThrow(
      "signature verification failed",
    );
  });

  it("fails closed when discovery does not provide a jwks_uri", async () => {
    mockSsoSettings(baseSettings);

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          issuer: "https://idp.example.com",
          authorization_endpoint: "https://idp.example.com/authorize",
          token_endpoint: "https://idp.example.com/token",
          // no jwks_uri
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => tokenResponse,
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    await expect(exchangeOidcCode("auth-code")).rejects.toThrow(/jwks_uri/i);
    expect(vi.mocked(jwtVerify)).not.toHaveBeenCalled();
  });
});
