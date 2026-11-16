import { describe, it, expect, vi, beforeEach } from "vitest";

// Automock for the Prisma client (see src/lib/__mocks__/prisma.ts).
vi.mock("@/lib/prisma");

import { findForeignReference } from "@/lib/org-references";
import prisma from "@/lib/prisma";

const mockPrisma = vi.mocked(prisma, true);

const ORG_ID = "org-uuid-001";
const MANUFACTURER_ID = "11111111-1111-4111-8111-111111111111";
const USER_A = "22222222-2222-4222-8222-222222222222";
const USER_B = "33333333-3333-4333-8333-333333333333";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findForeignReference", () => {
  it("skips absent, null and empty references without querying", async () => {
    const foreign = await findForeignReference(ORG_ID, {
      manufacturer: undefined,
      supplier: null,
      location: "",
      user: [],
    });

    expect(foreign).toBeNull();
    expect(mockPrisma.manufacturer.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.supplier.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.location.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });

  it("looks the id up inside the caller's organization", async () => {
    mockPrisma.manufacturer.findMany.mockResolvedValue([
      { manufacturerid: MANUFACTURER_ID },
    ] as never);

    const foreign = await findForeignReference(ORG_ID, {
      manufacturer: MANUFACTURER_ID,
    });

    expect(foreign).toBeNull();
    expect(mockPrisma.manufacturer.findMany).toHaveBeenCalledWith({
      where: {
        manufacturerid: { in: [MANUFACTURER_ID] },
        organizationId: ORG_ID,
      },
      select: { manufacturerid: true },
    });
  });

  it("limits an org-less caller to org-less rows", async () => {
    await findForeignReference(null, { manufacturer: MANUFACTURER_ID });

    expect(mockPrisma.manufacturer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: null }),
      }),
    );
  });

  it("returns the kind whose id is not in the organization", async () => {
    mockPrisma.manufacturer.findMany.mockResolvedValue([
      { manufacturerid: MANUFACTURER_ID },
    ] as never);
    mockPrisma.componentCategory.findMany.mockResolvedValue([]);

    const foreign = await findForeignReference(ORG_ID, {
      manufacturer: MANUFACTURER_ID,
      componentCategory: "44444444-4444-4444-8444-444444444444",
    });

    expect(foreign).toBe("componentCategory");
  });

  it("de-duplicates id lists and fails when any id is foreign", async () => {
    mockPrisma.user.findMany.mockResolvedValue([{ userid: USER_A }] as never);

    const foreign = await findForeignReference(ORG_ID, {
      user: [USER_A, USER_A, USER_B],
    });

    expect(foreign).toBe("user");
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userid: { in: [USER_A, USER_B] }, organizationId: ORG_ID },
      }),
    );
  });
});
