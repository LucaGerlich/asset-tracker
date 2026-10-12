import { Prisma } from "@prisma/client";
import prisma from "./prisma";

/**
 * Exact, case-insensitive email lookups on the user table.
 *
 * Prisma's `{ equals, mode: "insensitive" }` can compile to an ILIKE in which
 * `_` and `%` act as wildcards, so `a_b@x.io` would also match `aXb@x.io`.
 * These helpers compare `lower(email) = lower(<value>)` instead, with every
 * value sent as a bound parameter (never concatenated into the statement).
 *
 * The generated client qualifies Prisma-managed tables with the schema that
 * prisma/set-schema.mjs wrote into schema.prisma (DB_SCHEMA), and the pg
 * adapter sets no search_path. Raw SQL therefore names the schema explicitly,
 * validated like the other raw-SQL modules (rate-limit, cache, account-lockout).
 */

const S = process.env.DB_SCHEMA || "assettool";
if (!/^[a-zA-Z0-9_]+$/.test(S)) {
  throw new Error(
    `Invalid DB_SCHEMA: "${S}". Only alphanumeric and underscores allowed.`,
  );
}
const USER_TABLE = Prisma.raw(`"${S}"."user"`);

/**
 * What the helpers run their statement on: the shared client by default, or a
 * transaction client, so an integration test can roll everything back.
 */
type RawQueryClient = Pick<Prisma.TransactionClient, "$queryRaw">;

async function countUsers(
  condition: Prisma.Sql,
  db: RawQueryClient,
): Promise<number> {
  const rows = await db.$queryRaw<Array<{ count: number }>>(
    Prisma.sql`SELECT count(*)::int AS count FROM ${USER_TABLE} WHERE ${condition}`,
  );
  return rows[0]?.count ?? 0;
}

/**
 * How many users hold this address, ignoring case. `excludeUserId` leaves one
 * user out, so an account does not conflict with its own current address.
 */
export function countUsersByEmail(
  email: string,
  excludeUserId?: string,
  db: RawQueryClient = prisma,
): Promise<number> {
  const sameEmail = Prisma.sql`lower("email") = lower(${email})`;
  return countUsers(
    excludeUserId
      ? Prisma.sql`${sameEmail} AND "userid" <> ${excludeUserId}::uuid`
      : sameEmail,
    db,
  );
}

/** Whether this specific user currently holds the address, ignoring case. */
export async function userHoldsEmail(
  userId: string,
  email: string,
  db: RawQueryClient = prisma,
): Promise<boolean> {
  return (
    (await countUsers(
      Prisma.sql`"userid" = ${userId}::uuid AND lower("email") = lower(${email})`,
      db,
    )) > 0
  );
}
