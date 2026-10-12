import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  default: {
    organization: { findUnique: vi.fn() },
    asset: { count: vi.fn() },
    user: { count: vi.fn() },
  },
}));

vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi.fn(),
}));

import { checkAssetLimit, checkUserLimit } from "../tenant-limits";
import prisma from "@/lib/prisma";
import { getOrganizationContext } from "@/lib/organization-context";

const mockPrisma = vi.mocked(prisma, true);
const mockGetOrgContext = vi.mocked(getOrganizationContext);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkAssetLimit", () => {
  it("allows when no organization context (no orgId)", async () => {
    mockGetOrgContext.mockResolvedValue(null as any);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(true);
    expect(result.max).toBe(-1);
  });

  it("allows when org not found in database", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue(null);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(true);
    expect(result.max).toBe(-1);
  });

  it("allows when org has unlimited assets (maxAssets = -1)", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxAssets: -1,
    } as any);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(true);
  });

  it("allows when asset count is under limit", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxAssets: 100,
    } as any);
    mockPrisma.asset.count.mockResolvedValue(50);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(50);
    expect(result.max).toBe(100);
  });

  it("blocks when asset count is at limit", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxAssets: 100,
    } as any);
    mockPrisma.asset.count.mockResolvedValue(100);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(100);
    expect(result.max).toBe(100);
  });

  it("blocks when asset count exceeds limit", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxAssets: 50,
    } as any);
    mockPrisma.asset.count.mockResolvedValue(55);
    const result = await checkAssetLimit();
    expect(result.allowed).toBe(false);
  });
});

describe("checkUserLimit", () => {
  it("allows when no organization context", async () => {
    mockGetOrgContext.mockResolvedValue(null as any);
    const result = await checkUserLimit();
    expect(result.allowed).toBe(true);
    expect(result.max).toBe(-1);
  });

  it("allows when org has unlimited users", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxUsers: -1,
    } as any);
    const result = await checkUserLimit();
    expect(result.allowed).toBe(true);
  });

  it("allows when user count is under limit", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxUsers: 50,
    } as any);
    mockPrisma.user.count.mockResolvedValue(25);
    const result = await checkUserLimit();
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(25);
    expect(result.max).toBe(50);
  });

  it("blocks when user count is at limit", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "org-1" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxUsers: 10,
    } as any);
    mockPrisma.user.count.mockResolvedValue(10);
    const result = await checkUserLimit();
    expect(result.allowed).toBe(false);
    expect(result.current).toBe(10);
    expect(result.max).toBe(10);
  });
});

describe("explicit organizationId", () => {
  it("checkUserLimit uses the given org instead of the session's", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "session-org" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxUsers: 10,
    } as any);
    mockPrisma.user.count.mockResolvedValue(10);

    const result = await checkUserLimit("invite-org");

    expect(result.allowed).toBe(false);
    expect(mockGetOrgContext).not.toHaveBeenCalled();
    expect(mockPrisma.organization.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "invite-org" } }),
    );
    expect(mockPrisma.user.count).toHaveBeenCalledWith({
      where: { organizationId: "invite-org" },
    });
  });

  it("checkAssetLimit uses the given org instead of the session's", async () => {
    mockGetOrgContext.mockResolvedValue({
      organization: { id: "session-org" },
    } as any);
    mockPrisma.organization.findUnique.mockResolvedValue({
      maxAssets: 100,
    } as any);
    mockPrisma.asset.count.mockResolvedValue(3);

    const result = await checkAssetLimit("other-org");

    expect(result.allowed).toBe(true);
    expect(mockGetOrgContext).not.toHaveBeenCalled();
    expect(mockPrisma.asset.count).toHaveBeenCalledWith({
      where: { organizationId: "other-org" },
    });
  });
});
