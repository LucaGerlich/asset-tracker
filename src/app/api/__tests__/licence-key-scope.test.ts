import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  parseResponse,
} from "../../../../tests/setup/test-helpers";

vi.mock("@/lib/prisma");
vi.mock("@/lib/api-auth");
vi.mock("@/lib/logger");
vi.mock("@/lib/audit-log", () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  AUDIT_ACTIONS: { CREATE: "CREATE", UPDATE: "UPDATE", DELETE: "DELETE" },
  AUDIT_ENTITIES: { LICENCE: "LICENCE" },
}));
vi.mock("@/lib/webhooks", () => ({
  triggerWebhook: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/cache", () => ({
  invalidateCacheByPrefix: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/org-references", () => ({
  findForeignReference: vi.fn().mockResolvedValue(null),
  foreignReferenceError: vi.fn(),
}));
vi.mock("@/lib/organization-context", () => ({
  getOrganizationContext: vi
    .fn()
    .mockResolvedValue({ organization: { id: "org-uuid-001" } }),
  scopeToOrganization: vi.fn(),
}));

import { POST as createLicence } from "@/app/api/licence/route";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const mockPrisma = vi.mocked(prisma, true);

const uuid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/licence duplicate key", () => {
  it("answers 409 with a clear message when the key exists in the same organization", async () => {
    mockPrisma.licence.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const res = await createLicence(
      createMockRequest("/api/licence", {
        method: "POST",
        body: {
          licencekey: "ABCD-1234",
          licencecategorytypeid: uuid(1),
          manufacturerid: uuid(2),
          supplierid: uuid(3),
        },
      }),
    );
    const { status, body } = await parseResponse<{ error: string }>(res);

    expect(status).toBe(409);
    expect(body.error).toBe(
      "A licence with this key already exists in your organization",
    );
  });
});
