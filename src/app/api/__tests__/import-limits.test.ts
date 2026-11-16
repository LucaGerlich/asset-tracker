import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

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

const mockPrisma = vi.mocked(prisma, true);

function importLocations(csv: string, columnMapping?: string) {
  const form = new FormData();
  form.set("file", new File([csv], "locations.csv", { type: "text/csv" }));
  form.set("entityType", "location");
  if (columnMapping !== undefined) form.set("columnMapping", columnMapping);
  return importCsv(
    new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: form,
    }),
  );
}

const rows = (count: number) =>
  "locationname\n" +
  Array.from({ length: count }, (_, i) => `Site ${i}`).join("\n");

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    organizationId: "org-uuid-001",
  } as never);
  mockPrisma.importJob.create.mockResolvedValue({ id: "job-1" } as never);
  mockPrisma.importJob.update.mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: "job-1", ...args.data })) as never);
  mockPrisma.location.create.mockResolvedValue({} as never);
});

describe("POST /api/import limits", () => {
  it("rejects a file larger than 5 MB before processing it", async () => {
    const big = "locationname\n" + "x".repeat(5 * 1024 * 1024 + 1);

    const res = await importLocations(big);

    expect(res.status).toBe(400);
    expect(mockPrisma.importJob.create).not.toHaveBeenCalled();
  });

  it("rejects more than 5000 data rows", async () => {
    const res = await importLocations(rows(5001));

    expect(res.status).toBe(400);
    expect(mockPrisma.importJob.create).not.toHaveBeenCalled();
    expect(mockPrisma.location.create).not.toHaveBeenCalled();
  });

  it("accepts exactly 5000 data rows", async () => {
    const res = await importLocations(rows(5000));

    expect(res.status).toBe(201);
  });
});

describe("POST /api/import columnMapping validation", () => {
  it.each([
    ["an array", "[1,2]"],
    ["a string value", '{"locationname":"0"}'],
    ["a fractional index", '{"locationname":0.5}'],
    ["a hugely out-of-range index", '{"locationname":99999999}'],
    ["a null", "null"],
  ])("rejects %s", async (_label, mapping) => {
    const res = await importLocations(rows(1), mapping);

    expect(res.status).toBe(400);
    expect(mockPrisma.location.create).not.toHaveBeenCalled();
  });

  it("accepts a valid mapping, with -1 for unmapped fields", async () => {
    const res = await importLocations(
      rows(1),
      '{"locationname":0,"description":-1}',
    );

    expect(res.status).toBe(201);
  });
});
