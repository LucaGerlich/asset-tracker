import { describe, it, expect, vi, beforeEach } from "vitest";

// Automock for the Prisma client (see src/lib/__mocks__/prisma.ts).
vi.mock("@/lib/prisma");

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

import * as data from "@/lib/data";
import {
  getAssetById,
  getAssetOptions,
  getLocationOptions,
  getUserById,
  getUserOptions,
  publicUserSelect,
} from "@/lib/data";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockGetOrgContext = vi.mocked(getOrganizationContext);

const ORG_ID = "org-uuid-001";

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgContext.mockResolvedValue({
    organization: { id: ORG_ID, name: "Acme", slug: "acme", settings: null },
    userId: "user-uuid-001",
    departmentId: null,
    isAdmin: false,
    permissions: new Set(),
  } as any);
});

describe("data.ts org scoping — getAssetById", () => {
  it("scopes the lookup to the caller's organization", async () => {
    mockPrisma.asset.findFirst.mockResolvedValue({
      assetid: "asset-1",
      organizationId: ORG_ID,
    } as any);

    await getAssetById("asset-1");

    expect(mockPrisma.asset.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          assetid: "asset-1",
          organizationId: ORG_ID,
        }),
      }),
    );
  });

  it("throws when the asset does not belong to the caller's organization", async () => {
    // A cross-org UUID guess resolves to no row once findFirst is scoped.
    mockPrisma.asset.findFirst.mockResolvedValue(null);

    await expect(getAssetById("asset-1")).rejects.toThrow();
  });

  it("throws (fails closed) when there is no organization context", async () => {
    mockGetOrgContext.mockResolvedValue(null);

    await expect(getAssetById("asset-1")).rejects.toThrow(
      "Organization context required",
    );
  });
});

/** Columns that must never reach a client component through a user row. */
const SECRET_USER_COLUMNS = [
  "password",
  "ldapDN",
  "externalId",
  "scimProviderId",
  "scimLastSync",
  "lastSyncedAt",
  "image",
  "emailVerified",
  "twoFactorEnabled",
];

describe("data.ts getUserById — no secrets in the returned row", () => {
  it("selects an explicit, secret-free column set", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ userid: "user-1" } as never);

    await getUserById("user-1");

    const args = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
      select?: Record<string, boolean>;
    };
    expect(args.where).toMatchObject({
      userid: "user-1",
      organizationId: ORG_ID,
    });
    expect(args.select).toBeDefined();
    for (const column of SECRET_USER_COLUMNS) {
      expect(args.select).not.toHaveProperty(column);
    }
  });

  it("still selects every column the user pages render", async () => {
    // user/[id]/page.tsx, UserResources and UserEditForm read exactly these.
    for (const column of [
      "userid",
      "firstname",
      "lastname",
      "username",
      "email",
      "lan",
      "isadmin",
      "canrequest",
      "departmentId",
      "accessExpiresAt",
      "creation_date",
      "change_date",
    ]) {
      expect(publicUserSelect).toHaveProperty(column, true);
    }
  });

  it("throws when the user is outside the caller's organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    await expect(getUserById("user-1")).rejects.toThrow();
  });
});

describe("data.ts picker options — scoped to the caller's organization", () => {
  it("getUserOptions filters users by organization", async () => {
    await getUserOptions();

    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_ID } }),
    );
  });

  it("getAssetOptions filters assets by organization", async () => {
    await getAssetOptions();

    expect(mockPrisma.asset.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_ID } }),
    );
  });

  it("getLocationOptions filters locations by organization", async () => {
    await getLocationOptions();

    expect(mockPrisma.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: ORG_ID } }),
    );
  });

  it("fails closed without an organization context", async () => {
    mockGetOrgContext.mockResolvedValue(null);

    await expect(getUserOptions()).rejects.toThrow(
      "Organization context required",
    );
    await expect(getAssetOptions()).rejects.toThrow(
      "Organization context required",
    );
    await expect(getLocationOptions()).rejects.toThrow(
      "Organization context required",
    );
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.asset.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.location.findMany).not.toHaveBeenCalled();
  });
});

describe("data.ts has no unscoped write helpers", () => {
  it("does not export updateUser or updateUserAsset", () => {
    expect(data).not.toHaveProperty("updateUser");
    expect(data).not.toHaveProperty("updateUserAsset");
  });
});
