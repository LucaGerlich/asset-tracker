import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: { findUnique: vi.fn() },
    user: { count: vi.fn() },
  },
}));

vi.mock("@/lib/deployment-mode", () => ({
  isSelfHosted: vi.fn(() => false),
}));

import { resolveSsoUserData } from "../sso-provisioning";
import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";

const mockPrisma = vi.mocked(prisma, true);
const ORG_ID = "11111111-1111-1111-1111-111111111111";
const TENANT_ID = "22222222-2222-2222-2222-222222222222";
const ssoUser = { email: "jane@fitseveneleven.de", name: "Jane" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SSO_DEFAULT_ORGANIZATION_ID", ORG_ID);
  vi.stubEnv("MICROSOFT_TENANT_ID", TENANT_ID);
  mockPrisma.organization.findUnique.mockResolvedValue({
    isActive: true,
    maxUsers: 10,
  } as never);
  mockPrisma.user.count.mockResolvedValue(3 as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSsoUserData", () => {
  it("assigns Microsoft users to the configured org", async () => {
    const result = await resolveSsoUserData(ssoUser, "microsoft");
    expect(result).toEqual({
      ...ssoUser,
      organizationId: ORG_ID,
      authProvider: "microsoft",
    });
  });

  it("rejects when no default org is configured", async () => {
    vi.stubEnv("SSO_DEFAULT_ORGANIZATION_ID", "");
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });

  it.each(["", "common", "organizations", "consumers"])(
    "rejects when the Microsoft tenant is not pinned (%s)",
    async (tenant) => {
      vi.stubEnv("MICROSOFT_TENANT_ID", tenant);
      expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
    },
  );

  it("rejects providers without tenant restriction", async () => {
    expect(await resolveSsoUserData(ssoUser, "google")).toBeNull();
  });

  it("rejects when the org is missing or inactive", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: false,
      maxUsers: 10,
    } as never);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });

  it("rejects when the org user quota is full", async () => {
    mockPrisma.user.count.mockResolvedValue(10 as never);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).toBeNull();
  });

  it("ignores the quota when self-hosted or unlimited", async () => {
    mockPrisma.user.count.mockResolvedValue(10 as never);
    vi.mocked(isSelfHosted).mockReturnValueOnce(true);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).not.toBeNull();
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: true,
      maxUsers: -1,
    } as never);
    expect(await resolveSsoUserData(ssoUser, "microsoft")).not.toBeNull();
  });
});
