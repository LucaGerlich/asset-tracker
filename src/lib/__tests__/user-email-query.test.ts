import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Prisma } from "@prisma/client";

vi.mock("@/lib/prisma");

import prisma from "@/lib/prisma";
import { countUsersByEmail, userHoldsEmail } from "@/lib/user-email-query";

const mockPrisma = vi.mocked(prisma, true);
const SCHEMA = process.env.DB_SCHEMA || "assettool";

/** The parameterized statement the helper handed to prisma.$queryRaw. */
function sentQuery(): Prisma.Sql {
  expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
  return mockPrisma.$queryRaw.mock.calls[0][0] as unknown as Prisma.Sql;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([]);
});

describe("countUsersByEmail", () => {
  it("compares lower-cased values with = on the schema-qualified user table", async () => {
    await countUsersByEmail("a@b.io");

    const query = sentQuery();
    expect(query.text).toContain(`FROM "${SCHEMA}"."user"`);
    expect(query.text).toContain(`lower("email") = lower($1)`);
    expect(query.values).toEqual(["a@b.io"]);
  });

  it("never uses a pattern match, so _ and % in the address are literal", async () => {
    await countUsersByEmail("a_b%@x.io");

    const query = sentQuery();
    expect(query.text).not.toMatch(/like/i);
    // The wildcard characters travel as a bound value: aXb@x.io is a different
    // string and cannot match a_b@x.io under an equality comparison.
    expect(query.values).toEqual(["a_b%@x.io"]);
    expect(query.text).not.toContain("a_b");
  });

  it("keeps hostile input out of the SQL text", async () => {
    const hostile = `x'; DROP TABLE "user"; --@x.io`;
    await countUsersByEmail(hostile);

    const query = sentQuery();
    expect(query.text).not.toContain("DROP TABLE");
    expect(query.values).toEqual([hostile]);
  });

  it("excludes the given user id with a second bound parameter", async () => {
    await countUsersByEmail("a@b.io", "user-1");

    const query = sentQuery();
    expect(query.text).toContain(`"userid" <> $2::uuid`);
    expect(query.values).toEqual(["a@b.io", "user-1"]);
  });

  it("returns the counted rows", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 2 }]);

    await expect(countUsersByEmail("a@b.io")).resolves.toBe(2);
  });

  it("returns 0 when no row comes back", async () => {
    await expect(countUsersByEmail("a@b.io")).resolves.toBe(0);
  });
});

describe("userHoldsEmail", () => {
  it("looks the user up by id and compares the address with =", async () => {
    await userHoldsEmail("user-1", "root@x.io");

    const query = sentQuery();
    expect(query.text).toContain(`FROM "${SCHEMA}"."user"`);
    expect(query.text).toContain(`"userid" = $1::uuid`);
    expect(query.text).toContain(`lower("email") = lower($2)`);
    expect(query.text).not.toMatch(/like/i);
    expect(query.values).toEqual(["user-1", "root@x.io"]);
  });

  it("is true when the user holds the address", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 1 }]);

    await expect(userHoldsEmail("user-1", "root@x.io")).resolves.toBe(true);
  });

  it("is false when the user does not hold the address", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ count: 0 }]);

    await expect(userHoldsEmail("user-1", "root@x.io")).resolves.toBe(false);
  });
});
