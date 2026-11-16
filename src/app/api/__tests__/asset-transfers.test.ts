import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

/**
 * Asset transfers stay inside the caller's organization: user and location
 * transfers only, writing through the organization filter. Moving an asset into
 * another organization was removed in 0.15.3 (TECHNICAL_DEBT item 83), so that
 * transfer type is refused for everyone, super-admins included.
 */

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");

import { POST } from "@/app/api/asset/transfers/route";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const CALLER_ORG = "org-uuid-001";
const ASSET_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_ORG = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const LOCATION_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const USER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const transfer = (body: Record<string, unknown>) =>
  POST(
    createMockRequest("/api/asset/transfers", {
      method: "POST",
      body: { assetId: ASSET_ID, ...body },
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.asset.findFirst.mockResolvedValue({
    assetid: ASSET_ID,
    organizationId: CALLER_ORG,
    locationid: null,
  } as Awaited<ReturnType<typeof prisma.asset.findFirst>>);
});

describe("POST /api/asset/transfers", () => {
  it("refuses an organization transfer and moves nothing", async () => {
    const { status } = await parseResponse(
      await transfer({ transferType: "organization", toOrgId: OTHER_ORG }),
    );

    expect(status).toBe(400);
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    expect(mockPrisma.asset.update).not.toHaveBeenCalled();
  });

  it("moves the asset to a location of the caller's organization", async () => {
    mockPrisma.location.findFirst.mockResolvedValue({
      locationid: LOCATION_ID,
    } as Awaited<ReturnType<typeof prisma.location.findFirst>>);

    const { status } = await parseResponse(
      await transfer({ transferType: "location", toLocationId: LOCATION_ID }),
    );

    expect(status).toBe(201);
    expect(mockPrisma.asset.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { assetid: ASSET_ID, organizationId: CALLER_ORG },
      }),
    );
  });

  it("reassigns the asset to a user of the caller's organization", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      userid: USER_ID,
    } as Awaited<ReturnType<typeof prisma.user.findFirst>>);

    const { status } = await parseResponse(
      await transfer({ transferType: "user", toUserId: USER_ID }),
    );

    expect(status).toBe(201);
    expect(mockPrisma.userAssets.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userid: USER_ID, assetid: ASSET_ID }),
      }),
    );
  });
});
