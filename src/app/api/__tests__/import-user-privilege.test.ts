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
import { requirePermission } from "@/lib/api-auth";

const mockPrisma = vi.mocked(prisma, true);

const importUsers = (csv: string) => {
  const form = new FormData();
  form.set("file", new File([csv], "users.csv", { type: "text/csv" }));
  form.set("entityType", "user");
  return importCsv(
    new NextRequest("http://localhost:3000/api/import", {
      method: "POST",
      body: form,
    }),
  );
};

const caller = (isAdmin: boolean) =>
  vi.mocked(requirePermission).mockResolvedValue({
    id: "importer-uuid",
    isAdmin,
    organizationId: "org-uuid-001",
    orgStatus: "active",
  });

const createdUsers = () =>
  mockPrisma.user.create.mock.calls.map(
    (call) => call[0].data as Record<string, unknown>,
  );

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findUnique.mockResolvedValue({
    organizationId: "org-uuid-001",
  } as never);
  mockPrisma.user.create.mockResolvedValue({ userid: "new-user" } as never);
  mockPrisma.accounts.create.mockResolvedValue({} as never);
  mockPrisma.importJob.create.mockResolvedValue({ id: "job-1" } as never);
  mockPrisma.importJob.update.mockImplementation((async (args: {
    data: Record<string, unknown>;
  }) => ({ id: "job-1", ...args.data })) as never);
});

describe("POST /api/import user rows", () => {
  const csv =
    "username,firstname,lastname,isadmin,canrequest\n" +
    "ada,Ada,Lovelace,true,true\n" +
    "bob,Bob,Builder,1,false\n" +
    "cy,Cy,Young,false,\n";

  it("never creates admins when the importer is not an admin", async () => {
    caller(false);

    const res = await importUsers(csv);

    expect(res.status).toBe(201);
    expect(createdUsers().map((u) => u.isadmin)).toEqual([false, false, false]);
  });

  it("keeps the canrequest column working for non-admin importers", async () => {
    caller(false);

    await importUsers(csv);

    expect(createdUsers().map((u) => u.canrequest)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("lets an admin importer set isadmin from the file", async () => {
    caller(true);

    await importUsers(csv);

    expect(createdUsers().map((u) => u.isadmin)).toEqual([true, true, false]);
  });
});
