import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/cron-auth", () => ({ isValidCronAuth: vi.fn(() => true) }));

import { GET } from "@/app/api/cron/check-trials/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.organization.findMany.mockResolvedValue([
    { id: "org-1", name: "Acme", trialEndsAt: new Date(0) },
  ] as never);
  mockPrisma.organization.updateMany.mockResolvedValue({ count: 1 } as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/cron/check-trials", () => {
  it("records starter entitlements when legacy billing is active", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");

    await GET();

    expect(mockPrisma.organization.updateMany.mock.calls[0][0]?.data).toEqual({
      plan: "starter",
      trialEndsAt: null,
      maxAssets: 100,
      maxUsers: 3,
      entitlements: { features: [], maxAssets: 100, maxUsers: 3 },
    });
  });

  it("writes no entitlements without legacy billing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");

    await GET();

    expect(
      mockPrisma.organization.updateMany.mock.calls[0][0]?.data,
    ).not.toHaveProperty("entitlements");
  });
});
