import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { findUserByLoginIdentifier } from "@/lib/login-identifier";

const mockPrisma = vi.mocked(prisma, true);

const select = { userid: true, email: true } as const;

type LookupArgs = { where: { email?: string; username?: string } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findUserByLoginIdentifier", () => {
  it("prefers the exact email match over a user whose username equals it", async () => {
    mockPrisma.user.findFirst.mockImplementation((async ({
      where,
    }: LookupArgs) =>
      where.email === "victim@example.com"
        ? { userid: "victim" }
        : where.username === "victim@example.com"
          ? { userid: "attacker" }
          : null) as never);

    const user = await findUserByLoginIdentifier("victim@example.com", select);

    expect(user).toEqual({ userid: "victim" });
  });

  it("falls back to the username when no email matches", async () => {
    mockPrisma.user.findFirst.mockImplementation((async ({
      where,
    }: LookupArgs) =>
      where.username === "jane" ? { userid: "jane" } : null) as never);

    const user = await findUserByLoginIdentifier("jane", select);

    expect(user).toEqual({ userid: "jane" });
    expect(mockPrisma.user.findFirst).toHaveBeenCalledTimes(2);
  });

  it("returns null when nothing matches", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    expect(await findUserByLoginIdentifier("nobody", select)).toBeNull();
  });
});
