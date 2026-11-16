import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "create" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/integrations/slack-teams", () => ({
  notifyIntegrations: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/tenant-limits", () => ({
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
  checkAssetLimit: vi.fn().mockResolvedValue({ allowed: true, max: -1 }),
}));
vi.mock("bcryptjs", () => ({
  default: { hash: vi.fn().mockResolvedValue("hashed-password") },
}));

import { POST as importCsv } from "@/app/api/import/route";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";

const mockPrisma = vi.mocked(prisma, true);

/** Text a database error carries that must never reach a client. */
const INTERNAL =
  'Invalid `prisma.location.create()` invocation: column "locationname" of relation "location" at db.internal:5432';

interface RowError {
  row: number;
  error: string;
}

function importLocations(rows: string[]) {
  const form = new FormData();
  form.set(
    "file",
    new File(["locationname\n" + rows.join("\n")], "locations.csv", {
      type: "text/csv",
    }),
  );
  form.set("entityType", "location");
  return importCsv(
    new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: form,
    }),
  );
}

function importAccessories() {
  const form = new FormData();
  form.set(
    "file",
    new File(["accessoriename,accessorietag\nCable,ACC-1"], "acc.csv", {
      type: "text/csv",
    }),
  );
  form.set("entityType", "accessory");
  return importCsv(
    new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: form,
    }),
  );
}

/** The errors stored on the job by its final update. */
function storedErrors(): RowError[] | null {
  const finalUpdate = mockPrisma.importJob.update.mock.calls.at(-1)?.[0];
  return (finalUpdate?.data.errors ?? null) as unknown as RowError[] | null;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    organizationId: "org-uuid-001",
  } as never);
  mockPrisma.importJob.create.mockResolvedValue({ id: "job-1" } as never);
  // Echo what the route stores, like the database would return it.
  mockPrisma.importJob.update.mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: "job-1", ...args.data })) as never);
});

describe("POST /api/import row errors", () => {
  it("replaces a database error with a fixed message and logs the real one", async () => {
    const failure = new Error(INTERNAL);
    mockPrisma.location.create
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce({} as never);

    const res = await importLocations(["Berlin", "Hamburg"]);
    const job = (await res.json()) as {
      errors: RowError[];
      successCount: number;
    };

    expect(res.status).toBe(201);
    expect(job.successCount).toBe(1);
    expect(job.errors).toEqual([
      { row: 2, error: "Row could not be imported" },
    ]);
    expect(storedErrors()).toEqual(job.errors);
    expect(JSON.stringify(job)).not.toContain("locationname");
    expect(JSON.stringify(job)).not.toContain("db.internal");
    expect(logger.error).toHaveBeenCalledWith("Import row failed", {
      row: 2,
      entityType: "location",
      error: failure,
    });
  });

  it("does not echo a Prisma validation error either", async () => {
    mockPrisma.location.create.mockRejectedValue(
      new Prisma.PrismaClientValidationError(INTERNAL, {
        clientVersion: "test",
      }),
    );

    const res = await importLocations(["Berlin"]);
    const job = (await res.json()) as { errors: RowError[] };

    expect(job.errors).toEqual([
      { row: 2, error: "Row could not be imported" },
    ]);
  });

  it.each([
    ["P2002", "A record with the same unique value already exists"],
    ["P2003", "A referenced record does not exist"],
  ])(
    "maps the known Prisma error %s to a user-facing message",
    async (code, message) => {
      mockPrisma.location.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError(INTERNAL, {
          code,
          clientVersion: "test",
        }),
      );

      const res = await importLocations(["Berlin"]);
      const job = (await res.json()) as { errors: RowError[] };

      expect(job.errors).toEqual([{ row: 2, error: message }]);
      expect(JSON.stringify(job)).not.toContain("locationname");
    },
  );

  it("keeps the message of a problem the import itself reports", async () => {
    const res = await importAccessories();
    const job = (await res.json()) as { errors: RowError[] };

    expect(job.errors).toHaveLength(1);
    expect(job.errors[0].error).toMatch(
      /^Missing required reference data for accessory import\./,
    );
    expect(mockPrisma.accessories.create).not.toHaveBeenCalled();
  });
});

describe("POST /api/import reference columns", () => {
  const REF = "11111111-1111-4111-8111-111111111111";

  function importRow(entityType: string, columns: Record<string, string>) {
    const form = new FormData();
    form.set(
      "file",
      new File(
        [
          Object.keys(columns).join(",") +
            "\n" +
            Object.values(columns).join(","),
        ],
        "rows.csv",
        { type: "text/csv" },
      ),
    );
    form.set("entityType", entityType);
    return importCsv(
      new NextRequest("http://localhost:3000/api/import", {
        method: "POST",
        body: form,
      }),
    );
  }

  it.each([
    [
      "accessory",
      {
        accessoriename: "Cable",
        accessorietag: "ACC-1",
        manufacturerid: REF,
        statustypeid: REF,
        accessoriecategorytypeid: REF,
        locationid: REF,
        supplierid: REF,
        modelid: REF,
      },
      () => mockPrisma.accessories.create,
    ],
    [
      "consumable",
      {
        consumablename: "Toner",
        manufacturerid: REF,
        consumablecategorytypeid: REF,
        supplierid: REF,
      },
      () => mockPrisma.consumable.create,
    ],
    [
      "licence",
      {
        licencekey: "KEY-1",
        manufacturerid: REF,
        licencecategorytypeid: REF,
        supplierid: REF,
      },
      () => mockPrisma.licence.create,
    ],
  ])(
    "rejects a %s row that names another organization's manufacturer",
    async (entityType, columns, create) => {
      // Every other reference resolves inside the importer's organization.
      for (const model of [
        "supplier",
        "location",
        "model",
        "statusType",
        "accessorieCategoryType",
        "consumableCategoryType",
        "licenceCategoryType",
      ] as const) {
        mockPrisma[model].findMany.mockResolvedValue([{}] as never);
      }
      mockPrisma.manufacturer.findMany.mockResolvedValue([]);

      const res = await importRow(entityType, columns);
      const job = (await res.json()) as { errors: RowError[] };

      expect(job.errors).toEqual([
        { row: 2, error: "Manufacturer not found in your organization" },
      ]);
      expect(create()).not.toHaveBeenCalled();
      expect(mockPrisma.manufacturer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            manufacturerid: { in: [REF] },
            organizationId: "org-uuid-001",
          },
        }),
      );
    },
  );
});
