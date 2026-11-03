/**
 * Resolve the value typed into the login field (email or username) to a user.
 *
 * An exact email match always wins over a username match, so a username that
 * happens to equal someone's email address cannot take over that login.
 */

import prisma from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function findUserByLoginIdentifier<S extends Prisma.userSelect>(
  identifier: string,
  select: S,
) {
  const byEmail = await prisma.user.findFirst({
    where: { email: identifier },
    select,
  });
  if (byEmail) return byEmail;
  return prisma.user.findFirst({ where: { username: identifier }, select });
}
