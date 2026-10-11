import { randomUUID } from "node:crypto";
import { describe, it, expect } from "vitest";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { countUsersByEmail, userHoldsEmail } from "@/lib/user-email-query";

// Integration test: runs the real exact-match email SQL against Postgres.
// Every test works inside a transaction that is rolled back, so nothing
// persists. Same gate as scope-automation-migration.test.ts: it runs only when
// ALLOW_DESTRUCTIVE_DB_TESTS=1 is set explicitly (CI sets it for its throwaway
// Postgres service); the DATABASE_URL host is never trusted, because a
// localhost tunnel to a shared database looks like a local one. Without the
// opt-in, or without a DATABASE_URL, it is skipped.
const databaseUrl = process.env.DATABASE_URL;
const describeDb =
  databaseUrl && process.env.ALLOW_DESTRUCTIVE_DB_TESTS === "1"
    ? describe
    : describe.skip;

// vitest's 5s default must not abandon a test while its transaction is running.
const DB_TEST = { timeout: 30_000 };

const SCHEMA = process.env.DB_SCHEMA || "assettool";
const USER_TABLE = `"${SCHEMA}"."user"`;

type Tx = Prisma.TransactionClient;

class Rollback extends Error {}

/** Runs `fn` in a transaction and always rolls it back. Errors from `fn` surface. */
async function inRolledBackTransaction(
  fn: (tx: Tx) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback();
      },
      { timeout: 30_000 },
    );
  } catch (error) {
    if (!(error instanceof Rollback)) throw error;
  }
}

/**
 * Insert a user with every NOT NULL column without a default (isadmin,
 * canrequest, firstname, lastname, creation_date); the rest default.
 */
async function insertUser(
  tx: Tx,
  userid: string,
  email: string | null,
): Promise<void> {
  await tx.$executeRawUnsafe(
    `INSERT INTO ${USER_TABLE}
       ("userid", "email", "firstname", "lastname", "creation_date", "canrequest", "isadmin")
     VALUES ($1::uuid, $2, 'Test', 'User', now(), false, false)`,
    userid,
    email,
  );
}

describeDb("exact email lookups against Postgres", () => {
  // The email column is unique case-sensitively, so a case variant is a
  // distinct row; "_" is the single-character wildcard of LIKE/ILIKE.
  const tag = randomUUID();
  const underscore = `a_b-${tag}@x.io`;
  const lookalike = `aXb-${tag}@x.io`;
  const caseVariant = `A_B-${tag}@X.IO`;
  const solo = `solo-${tag}@x.io`;

  const underscoreId = randomUUID();
  const lookalikeId = randomUUID();
  const caseVariantId = randomUUID();
  const soloId = randomUUID();

  async function seed(tx: Tx): Promise<void> {
    await insertUser(tx, underscoreId, underscore);
    await insertUser(tx, lookalikeId, lookalike);
    await insertUser(tx, caseVariantId, caseVariant);
    await insertUser(tx, soloId, solo);
  }

  it(
    "counts only exact case-insensitive matches, so _ is not a wildcard",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        await seed(tx);

        // Control: the ILIKE that Prisma's insensitive mode can compile to treats
        // "_" as a wildcard and also matches the look-alike address. This proves
        // the data would expose the bug.
        const ilike = await tx.$queryRawUnsafe<Array<{ count: number }>>(
          `SELECT count(*)::int AS count FROM ${USER_TABLE} WHERE "email" ILIKE $1`,
          underscore,
        );
        expect(ilike[0].count).toBe(3);

        // The helper matches the address itself and its case variant only.
        await expect(
          countUsersByEmail(underscore, undefined, tx),
        ).resolves.toBe(2);
        await expect(
          countUsersByEmail(underscore.toUpperCase(), undefined, tx),
        ).resolves.toBe(2);
        await expect(countUsersByEmail(lookalike, undefined, tx)).resolves.toBe(
          1,
        );
      });
    },
  );

  it("treats % in the address as a literal character", DB_TEST, async () => {
    await inRolledBackTransaction(async (tx) => {
      await seed(tx);

      await expect(
        countUsersByEmail(`%-${tag}@x.io`, undefined, tx),
      ).resolves.toBe(0);
      await expect(
        countUsersByEmail(`a%-${tag}@x.io`, undefined, tx),
      ).resolves.toBe(0);
    });
  });

  it("returns 0 for an address nobody holds", DB_TEST, async () => {
    await inRolledBackTransaction(async (tx) => {
      await seed(tx);

      await expect(
        countUsersByEmail(`nobody-${tag}@x.io`, undefined, tx),
      ).resolves.toBe(0);
    });
  });

  it("leaves the excluded user out of the count", DB_TEST, async () => {
    await inRolledBackTransaction(async (tx) => {
      await seed(tx);

      // The only holder, excluded: nobody else holds the address.
      await expect(countUsersByEmail(solo, undefined, tx)).resolves.toBe(1);
      await expect(countUsersByEmail(solo, soloId, tx)).resolves.toBe(0);
      // Excluding someone else changes nothing.
      await expect(countUsersByEmail(solo, underscoreId, tx)).resolves.toBe(1);
      // Two holders (address and case variant): excluding one leaves the other.
      await expect(
        countUsersByEmail(underscore, underscoreId, tx),
      ).resolves.toBe(1);
    });
  });

  it(
    "reports which user holds an address, ignoring case",
    DB_TEST,
    async () => {
      await inRolledBackTransaction(async (tx) => {
        await seed(tx);

        await expect(
          userHoldsEmail(underscoreId, underscore, tx),
        ).resolves.toBe(true);
        await expect(
          userHoldsEmail(underscoreId, underscore.toUpperCase(), tx),
        ).resolves.toBe(true);
        // The case-variant row holds it too (case-insensitively).
        await expect(
          userHoldsEmail(caseVariantId, underscore, tx),
        ).resolves.toBe(true);
        // The look-alike user holds a different address, wildcard or not.
        await expect(userHoldsEmail(lookalikeId, underscore, tx)).resolves.toBe(
          false,
        );
        await expect(userHoldsEmail(underscoreId, lookalike, tx)).resolves.toBe(
          false,
        );
        // A user that does not exist holds nothing.
        await expect(
          userHoldsEmail(randomUUID(), underscore, tx),
        ).resolves.toBe(false);
      });
    },
  );

  it("ignores users without an email", DB_TEST, async () => {
    await inRolledBackTransaction(async (tx) => {
      const noEmailId = randomUUID();
      await insertUser(tx, noEmailId, null);

      await expect(userHoldsEmail(noEmailId, solo, tx)).resolves.toBe(false);
    });
  });
});
