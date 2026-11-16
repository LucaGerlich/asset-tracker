import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn(),
  AUDIT_ACTIONS: {},
  AUDIT_ENTITIES: {},
}));

import { auth } from "@/lib/auth-server";

describe("auth server configuration", () => {
  it("keeps the session cookie cache short so revoked sessions die quickly", () => {
    const cookieCache = auth.options.session?.cookieCache;

    expect(cookieCache?.enabled).toBe(true);
    expect(cookieCache?.maxAge).toBeLessThanOrEqual(60);
  });

  it("trusts no OAuth provider for account linking without a pinned tenant", () => {
    expect(auth.options.account?.accountLinking?.trustedProviders).toEqual([]);
  });
});
