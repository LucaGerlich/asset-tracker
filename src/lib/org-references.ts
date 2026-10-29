import prisma from "./prisma";

/**
 * Org-scoped models that write bodies reference by id, with their Prisma
 * delegate and primary key. Delegate names must match the Prisma client.
 */
const REFERENCE_MODELS = {
  manufacturer: { delegate: "manufacturer", idField: "manufacturerid" },
  supplier: { delegate: "supplier", idField: "supplierid" },
  location: { delegate: "location", idField: "locationid" },
  model: { delegate: "model", idField: "modelid" },
  statusType: { delegate: "statusType", idField: "statustypeid" },
  assetCategory: {
    delegate: "assetCategoryType",
    idField: "assetcategorytypeid",
  },
  accessoryCategory: {
    delegate: "accessorieCategoryType",
    idField: "accessoriecategorytypeid",
  },
  consumableCategory: {
    delegate: "consumableCategoryType",
    idField: "consumablecategorytypeid",
  },
  licenceCategory: {
    delegate: "licenceCategoryType",
    idField: "licencecategorytypeid",
  },
  componentCategory: { delegate: "componentCategory", idField: "id" },
  department: { delegate: "department", idField: "id" },
  user: { delegate: "user", idField: "userid" },
  asset: { delegate: "asset", idField: "assetid" },
} as const;

export type ReferenceKind = keyof typeof REFERENCE_MODELS;

/** Human-readable names for error messages. */
const REFERENCE_LABELS: Record<ReferenceKind, string> = {
  manufacturer: "Manufacturer",
  supplier: "Supplier",
  location: "Location",
  model: "Model",
  statusType: "Status",
  assetCategory: "Asset category",
  accessoryCategory: "Accessory category",
  consumableCategory: "Consumable category",
  licenceCategory: "Licence category",
  componentCategory: "Component category",
  department: "Department",
  user: "User",
  asset: "Asset",
};

interface ReferenceDelegate {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>;
}

/**
 * Returns the first kind whose referenced id(s) do not belong to the caller's
 * organization, or null when every reference is in scope. Absent, null and
 * empty values are skipped so optional fields stay optional. Fails closed: an
 * org-less caller only matches org-less rows, like scopeToOrganization().
 */
export async function findForeignReference(
  organizationId: string | null | undefined,
  refs: Partial<Record<ReferenceKind, string | string[] | null | undefined>>,
): Promise<ReferenceKind | null> {
  for (const [kind, value] of Object.entries(refs) as [
    ReferenceKind,
    string | string[] | null | undefined,
  ][]) {
    const ids = [...new Set([value ?? []].flat().filter(Boolean))];
    if (ids.length === 0) continue;

    const { delegate, idField } = REFERENCE_MODELS[kind];
    const model = prisma[delegate] as unknown as ReferenceDelegate;
    const found = await model.findMany({
      where: { [idField]: { in: ids }, organizationId: organizationId ?? null },
      select: { [idField]: true },
    });
    if (found.length !== ids.length) return kind;
  }
  return null;
}

/** 400 body for a foreign reference, matching tickets/[id] and team/invite. */
export function foreignReferenceError(kind: ReferenceKind): { error: string } {
  return { error: `${REFERENCE_LABELS[kind]} not found in your organization` };
}
