import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");
vi.mock("@/lib/logger");
vi.mock("@/lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/email")>()),
  queueEmail: vi.fn(),
}));

import {
  checkExpiringLicenses,
  checkExpiringWarranties,
  checkLowStock,
  checkMaintenanceDue,
} from "@/lib/notifications";
import prisma from "@/lib/prisma";
import { queueEmail } from "@/lib/email";

const mockPrisma = vi.mocked(prisma, true);
const mockQueueEmail = vi.mocked(queueEmail);
const DAY_MS = 24 * 60 * 60 * 1000;

const licence = {
  expirationdate: new Date(Date.now() + 10 * DAY_MS),
  licencekey: "KEY-1",
  user: {
    userid: "user-1",
    email: "jane@example.com",
    firstname: "Jane",
    lastname: "Doe",
  },
  licenceCategoryType: { licencecategorytypename: "Office" },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.notification_preferences.findUnique.mockResolvedValue({
    emailLicenseExpiry: true,
    emailMaintenanceDue: true,
    emailLowStock: true,
  } as never);
});

describe("expiry notification de-duplication", () => {
  it("queues a license warning the first time", async () => {
    mockPrisma.licence.findMany.mockResolvedValue([licence] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue(null);

    expect(await checkExpiringLicenses()).toBe(1);
    expect(mockQueueEmail).toHaveBeenCalledTimes(1);
  });

  it("skips a license already queued for this recipient inside the 30-day window", async () => {
    mockPrisma.licence.findMany.mockResolvedValue([licence] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue({
      id: "q-1",
    } as never);

    expect(await checkExpiringLicenses()).toBe(0);
    expect(mockQueueEmail).not.toHaveBeenCalled();

    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as {
      recipient: string;
      type: string;
      subject: string;
      body: { contains: string };
      createdAt: { gte: Date };
    };
    expect(where).toMatchObject({
      recipient: "jane@example.com",
      type: "license_expiry",
      subject: "License Expiring Soon: Office",
      body: { contains: "KEY-1" },
    });
    const windowMs = Date.now() - where.createdAt.gte.getTime();
    expect(Math.round(windowMs / DAY_MS)).toBe(30);
  });

  it("skips maintenance already queued inside the 7-day window", async () => {
    mockPrisma.maintenance_schedules.findMany.mockResolvedValue([
      {
        title: "Service",
        description: null,
        nextDueDate: new Date(Date.now() + 2 * DAY_MS),
        asset: { assetname: "Laptop", assettag: "TAG-9" },
        user: {
          userid: "user-1",
          email: "jane@example.com",
          firstname: "J",
          lastname: "D",
        },
      },
    ] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue({
      id: "q-1",
    } as never);

    expect(await checkMaintenanceDue()).toBe(0);

    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as { type: string; createdAt: { gte: Date } };
    expect(where.type).toBe("maintenance");
    expect(
      Math.round((Date.now() - where.createdAt.gte.getTime()) / DAY_MS),
    ).toBe(7);
  });

  it("skips a warranty alert already queued for that admin", async () => {
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetname: "Laptop",
        assettag: "TAG-9",
        serialnumber: "SN-1",
        organizationId: "org-1",
        warrantyExpires: new Date(Date.now() + 5 * DAY_MS),
      },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { userid: "admin-1", email: "admin@example.com" },
    ] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue({
      id: "q-1",
    } as never);

    expect(await checkExpiringWarranties()).toBe(0);
    expect(mockQueueEmail).not.toHaveBeenCalled();
  });
});

describe("admin recipient resolution", () => {
  it("only mails active admins of the item's own organization", async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: "org-1",
      },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { userid: "admin-1", email: "admin@example.com" },
    ] as never);

    await checkLowStock();

    expect(mockPrisma.user.findMany.mock.calls[0][0]?.where).toEqual({
      isadmin: true,
      isActive: true,
      organizationId: "org-1",
    });
  });

  it("mails nobody for an item without an organization", async () => {
    mockPrisma.consumable.findMany.mockResolvedValue([
      {
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: null,
      },
    ] as never);

    expect(await checkLowStock()).toBe(0);
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
  });
});
