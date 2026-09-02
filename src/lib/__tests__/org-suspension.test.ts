import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");

vi.mock("@/lib/deployment-mode", () => ({
  isSelfHosted: vi.fn().mockReturnValue(false),
}));

import prisma from "@/lib/prisma";
import { isSelfHosted } from "@/lib/deployment-mode";
import {
  getOrgStatus,
  getOrgSuspensionStatus,
  requireActiveOrg,
  requireWriteAccess,
} from "@/lib/org-suspension";

const mockPrisma = vi.mocked(prisma, true);
const mockIsSelfHosted = vi.mocked(isSelfHosted);

const NOW = new Date("2026-09-02T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

beforeEach(() => {
  vi.clearAllMocks();
  mockIsSelfHosted.mockReturnValue(false);
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getOrgStatus", () => {
  it("is active for a non-suspended org", () => {
    const status = getOrgStatus({ isActive: true, suspendedAt: null });
    expect(status).toBe("active");
  });

  it("is locked_out when isActive is false with no suspendedAt (admin-triggered)", () => {
    const status = getOrgStatus({ isActive: false, suspendedAt: null });
    expect(status).toBe("locked_out");
  });

  it("is read_only when suspended 13 days ago (within the grace period)", () => {
    const status = getOrgStatus({
      isActive: false,
      suspendedAt: new Date(NOW.getTime() - 13 * DAY_MS),
    });
    expect(status).toBe("read_only");
  });

  it("is read_only at exactly the 14-day grace period boundary", () => {
    const status = getOrgStatus({
      isActive: false,
      suspendedAt: new Date(NOW.getTime() - 14 * DAY_MS),
    });
    expect(status).toBe("read_only");
  });

  it("is locked_out once 15 days have passed (past the grace period)", () => {
    const status = getOrgStatus({
      isActive: false,
      suspendedAt: new Date(NOW.getTime() - 15 * DAY_MS),
    });
    expect(status).toBe("locked_out");
  });
});

describe("getOrgSuspensionStatus", () => {
  it("returns active in self-hosted mode regardless of org state", async () => {
    mockIsSelfHosted.mockReturnValue(true);
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: false,
      suspendedAt: new Date(NOW.getTime() - 30 * DAY_MS),
    } as any);

    const status = await getOrgSuspensionStatus("org-1");
    expect(status).toBe("active");
    expect(mockPrisma.organization.findUnique).not.toHaveBeenCalled();
  });

  it("returns active when the organization is not found", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue(null);

    const status = await getOrgSuspensionStatus("org-missing");
    expect(status).toBe("active");
  });

  it("returns the derived status for a suspended org past the grace period", async () => {
    mockPrisma.organization.findUnique.mockResolvedValue({
      isActive: false,
      suspendedAt: new Date(NOW.getTime() - 15 * DAY_MS),
    } as any);

    const status = await getOrgSuspensionStatus("org-1");
    expect(status).toBe("locked_out");
  });
});

describe("requireActiveOrg", () => {
  it("allows active and read_only orgs through", () => {
    expect(requireActiveOrg("active")).toBeNull();
    expect(requireActiveOrg("read_only")).toBeNull();
  });

  it("returns a 403 response for a locked_out org", () => {
    const result = requireActiveOrg("locked_out");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});

describe("requireWriteAccess", () => {
  it("allows writes only for a fully active org", () => {
    expect(requireWriteAccess("active")).toBeNull();
  });

  it("returns a 403 response for read_only orgs", () => {
    const result = requireWriteAccess("read_only");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });

  it("returns a 403 response for locked_out orgs", () => {
    const result = requireWriteAccess("locked_out");
    expect(result).not.toBeNull();
    expect(result?.status).toBe(403);
  });
});
