import prisma from "@/lib/prisma";

/**
 * Options for the user edit form. Roles are the organization's own plus the
 * platform's built-in roles (organizationId null); departments belong to the
 * organization only. A viewer without an organization gets no options rather
 * than an unfiltered query that would list every tenant's roles and
 * departments.
 */
export async function getUserEditOptions(
  organizationId: string | null,
  targetUserId: string,
) {
  if (!organizationId) {
    return { allRoles: [], userRoles: [], departments: [] };
  }

  const [allRoles, userRoles, departments] = await Promise.all([
    prisma.role.findMany({
      where: { OR: [{ organizationId }, { organizationId: null }] },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.userRole.findMany({
      where: { userId: targetUserId },
      include: { role: { select: { id: true, name: true } } },
    }),
    prisma.department.findMany({
      where: { organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return { allRoles, userRoles: userRoles.map((ur) => ur.role), departments };
}
