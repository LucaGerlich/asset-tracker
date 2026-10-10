import prisma from "@/lib/prisma";

/*
 * Organization-scoped loaders for the admin settings page. Each one takes the
 * viewer's organization and returns an empty list when there is none: an admin
 * without an organization owns no users, definitions or settings, and passing
 * a missing organizationId to Prisma would either match org-less rows
 * (null) or drop the filter altogether (undefined).
 */

export async function getUsers(organizationId: string | null) {
  if (!organizationId) return [];
  return await prisma.user.findMany({
    where: { organizationId },
    select: {
      userid: true,
      username: true,
      firstname: true,
      lastname: true,
      email: true,
      isadmin: true,
      canrequest: true,
      creation_date: true,
    },
    orderBy: [{ isadmin: "desc" }, { lastname: "asc" }],
  });
}

export async function getStatusTypes(organizationId: string | null) {
  if (!organizationId) return [];
  return await prisma.statusType.findMany({
    where: { organizationId },
    orderBy: { statustypename: "asc" },
  });
}

export async function getCustomFields(organizationId: string | null) {
  if (!organizationId) return [];
  return await prisma.custom_field_definitions.findMany({
    where: { organizationId },
    orderBy: [{ entityType: "asc" }, { displayOrder: "asc" }],
  });
}

/** Depreciation settings hang off an asset category, which carries the org. */
export async function getDepreciationSettings(organizationId: string | null) {
  if (!organizationId) return [];
  return await prisma.depreciation_settings.findMany({
    where: { assetCategoryType: { organizationId } },
    include: {
      assetCategoryType: true,
    },
  });
}
