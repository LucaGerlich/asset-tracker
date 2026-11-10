import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");
vi.mock("@/lib/organization-context", () => ({
  scopeToOrganization: vi.fn(
    (where: Record<string, unknown>, organizationId?: string | null) => ({
      ...where,
      organizationId: organizationId ?? null,
    }),
  ),
}));

import prisma from "@/lib/prisma";
import {
  findAdminDemotionViolation,
  guardedAdminDemotion,
  LAST_ADMIN_MESSAGE,
} from "@/lib/admin-demotion";

const mockPrisma = vi.mocked(prisma, true);

const params = {
  callerId: "caller",
  targetUserIds: ["target"],
  organizationId: "org-1",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findAdminDemotionViolation", () => {
  it("counts admins through the transaction client it is given", async () => {
    const tx = { user: { count: vi.fn().mockResolvedValue(0) } };

    const message = await findAdminDemotionViolation(
      params,
      tx as unknown as Prisma.TransactionClient,
    );

    expect(message).toBe(LAST_ADMIN_MESSAGE);
    expect(tx.user.count).toHaveBeenCalledTimes(1);
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("defaults to the shared client", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    expect(await findAdminDemotionViolation(params)).toBeNull();
    expect(mockPrisma.user.count).toHaveBeenCalledTimes(1);
  });
});

describe("guardedAdminDemotion", () => {
  it("runs the check and the write in one Serializable transaction", async () => {
    mockPrisma.user.count.mockResolvedValue(1);
    const write = vi.fn().mockResolvedValue("written");

    const outcome = await guardedAdminDemotion(params, write);

    expect(outcome).toEqual({ status: "ok", result: "written" });
    expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("does not write when the guard rejects", async () => {
    mockPrisma.user.count.mockResolvedValue(0);
    const write = vi.fn();

    const outcome = await guardedAdminDemotion(params, write);

    expect(outcome).toEqual({
      status: "violation",
      message: LAST_ADMIN_MESSAGE,
    });
    expect(write).not.toHaveBeenCalled();
  });

  it("reports a serialization failure (P2034) as a conflict", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("write conflict", {
        code: "P2034",
        clientVersion: "test",
      }),
    );

    const outcome = await guardedAdminDemotion(params, vi.fn());

    expect(outcome.status).toBe("conflict");
  });

  it("rethrows unrelated errors", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("boom"));
    await expect(guardedAdminDemotion(params, vi.fn())).rejects.toThrow("boom");
  });
});
