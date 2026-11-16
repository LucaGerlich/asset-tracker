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

const isoDate = (date: Date) => date.toISOString().slice(0, 10);

const licenceExpiry = new Date(Date.now() + 10 * DAY_MS);
const licence = {
  licenceid: "lic-1",
  expirationdate: licenceExpiry,
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
      body: { contains: `ref:lic-1:${isoDate(licenceExpiry)}` },
    });
    const windowMs = Date.now() - where.createdAt.gte.getTime();
    expect(Math.round(windowMs / DAY_MS)).toBe(30);
  });

  it("tells key-less licences apart and embeds the marker in the mail", async () => {
    mockPrisma.licence.findMany.mockResolvedValue([
      { ...licence, licenceid: "lic-a", licencekey: null },
      { ...licence, licenceid: "lic-b", licencekey: null },
    ] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue(null);

    expect(await checkExpiringLicenses()).toBe(2);

    const markers = mockPrisma.notification_queue.findFirst.mock.calls.map(
      (call) =>
        (call[0]?.where as { body: { contains: string } }).body.contains,
    );
    expect(new Set(markers).size).toBe(2);
    const html = mockQueueEmail.mock.calls[0][4];
    expect(html).toContain(markers[0]);
  });

  it("does not let tag A1 match a mail about tag A12", async () => {
    const warrantyExpires = new Date(Date.now() + 5 * DAY_MS);
    mockPrisma.asset.findMany.mockResolvedValue([
      {
        assetid: "asset-1",
        assetname: "Laptop",
        assettag: "A1",
        serialnumber: "SN-1",
        organizationId: "org-1",
        warrantyExpires,
      },
    ] as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { userid: "admin-1", email: "admin@example.com" },
    ] as never);
    mockPrisma.notification_queue.findFirst.mockResolvedValue(null);

    await checkExpiringWarranties();

    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as { body: { contains: string } };
    expect(where.body.contains).toBe(`ref:asset-1:${isoDate(warrantyExpires)}`);
    expect(where.body.contains).not.toContain("A1");
  });

  it("uses a fresh marker for the next due date of a recurring schedule", async () => {
    const dueDates = [
      new Date(Date.now() + 1 * DAY_MS),
      new Date(Date.now() + 2 * DAY_MS),
    ];
    const markers: string[] = [];
    for (const nextDueDate of dueDates) {
      mockPrisma.maintenance_schedules.findMany.mockResolvedValue([
        {
          id: "maint-1",
          title: "Service",
          description: null,
          nextDueDate,
          asset: { assetname: "Laptop", assettag: "TAG-9" },
          user: {
            userid: "user-1",
            email: "jane@example.com",
            firstname: "J",
            lastname: "D",
          },
        },
      ] as never);
      mockPrisma.notification_queue.findFirst.mockResolvedValue(null);
      await checkMaintenanceDue();
      const where = mockPrisma.notification_queue.findFirst.mock.calls.at(
        -1,
      )?.[0]?.where as { body: { contains: string } };
      markers.push(where.body.contains);
    }

    expect(markers[0]).toBe(`ref:maint-1:${isoDate(dueDates[0])}`);
    expect(markers[1]).toBe(`ref:maint-1:${isoDate(dueDates[1])}`);
  });

  it("skips maintenance already queued inside the 7-day window", async () => {
    mockPrisma.maintenance_schedules.findMany.mockResolvedValue([
      {
        id: "maint-1",
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
        assetid: "asset-1",
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
        consumableid: "con-1",
        consumablename: "Toner",
        quantity: 1,
        minQuantity: 5,
        organizationId: "org-1",
        change_date: null,
        creation_date: new Date("2026-01-01T00:00:00Z"),
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

describe("low-stock alert de-duplication", () => {
  const changedAt = new Date("2026-10-01T10:00:00Z");
  const toner = {
    consumableid: "con-1",
    consumablename: "Toner",
    quantity: 1,
    minQuantity: 5,
    organizationId: "org-1",
    change_date: changedAt,
    creation_date: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    mockPrisma.consumable.findMany.mockResolvedValue([toner] as never);
    mockPrisma.user.findMany.mockResolvedValue([
      { userid: "admin-1", email: "admin@example.com" },
    ] as never);
  });

  it("queues the alert with a marker the first time", async () => {
    mockPrisma.notification_queue.findFirst.mockResolvedValue(null);

    expect(await checkLowStock()).toBe(1);
    expect(mockQueueEmail.mock.calls[0][4]).toContain(
      `<!-- ref:con-1:${isoDate(changedAt)} -->`,
    );
  });

  it("skips an alert already queued for that admin and stock state", async () => {
    mockPrisma.notification_queue.findFirst.mockResolvedValue({
      id: "q-1",
    } as never);

    expect(await checkLowStock()).toBe(0);
    expect(mockQueueEmail).not.toHaveBeenCalled();

    const where = mockPrisma.notification_queue.findFirst.mock.calls[0][0]
      ?.where as {
      body: { contains: string };
      createdAt: { gte: Date };
    };
    expect(where).toMatchObject({
      recipient: "admin@example.com",
      type: "low_stock",
      body: { contains: `ref:con-1:${isoDate(changedAt)}` },
    });
    expect(Date.now() - where.createdAt.gte.getTime()).toBeGreaterThanOrEqual(
      7 * DAY_MS,
    );
  });
});
