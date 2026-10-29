import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin, requireWritableOrg } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { createAuditLog } from "@/lib/audit-log";
import { logger } from "@/lib/logger";
import {
  findForeignReference,
  foreignReferenceError,
  type ReferenceKind,
} from "@/lib/org-references";

/**
 * Map from the `entity` string stored in audit logs to the corresponding
 * Prisma model name and its primary-key field.
 */
const entityModelMap: Record<string, { model: string; idField: string }> = {
  asset: { model: "asset", idField: "assetid" },
  accessory: { model: "accessories", idField: "accessorieid" },
  consumable: { model: "consumable", idField: "consumableid" },
  licence: { model: "licence", idField: "licenceid" },
  license: { model: "licence", idField: "licenceid" },
  user: { model: "user", idField: "userid" },
  location: { model: "location", idField: "locationid" },
  manufacturer: { model: "manufacturer", idField: "manufacturerid" },
  supplier: { model: "supplier", idField: "supplierid" },
  model: { model: "model", idField: "modelid" },
  status_type: { model: "statusType", idField: "statustypeid" },
  component: { model: "component", idField: "id" },
  kit: { model: "kit", idField: "id" },
};

/**
 * Foreign-key columns a snapshot may write back, by the reference they hold.
 * A revert must not re-point a record at another tenant's rows.
 */
const referenceColumns: Record<string, ReferenceKind> = {
  modelid: "model",
  assetcategorytypeid: "assetCategory",
  statustypeid: "statusType",
  supplierid: "supplier",
  supplierId: "supplier",
  locationid: "location",
  locationId: "location",
  parentId: "location",
  manufacturerid: "manufacturer",
  manufacturerId: "manufacturer",
  accessoriecategorytypeid: "accessoryCategory",
  consumablecategorytypeid: "consumableCategory",
  licencecategorytypeid: "licenceCategory",
  licenceduserid: "user",
  departmentId: "department",
  categoryId: "componentCategory",
};

function snapshotReferences(
  data: Record<string, unknown>,
): Partial<Record<ReferenceKind, string[]>> {
  const refs: Partial<Record<ReferenceKind, string[]>> = {};
  for (const [column, kind] of Object.entries(referenceColumns)) {
    const value = data[column];
    if (typeof value === "string") refs[kind] = [...(refs[kind] ?? []), value];
  }
  return refs;
}

/**
 * Fields that must never be written back during a revert because they are
 * auto-managed by the database, represent relations, or are the primary key.
 */
const EXCLUDED_FIELDS = new Set([
  // Relation objects (Prisma will reject these as scalar writes)
  "assetCategoryType",
  "location",
  "manufacturer",
  "model",
  "organization",
  "statusType",
  "supplier",
  "accessorieCategoryType",
  "category",
  "user",
  // Common auto-managed or immutable fields
  "creation_date",
  "createdAt",
  "updatedAt",
  // Arrays / nested relations
  "asset_attachments",
  "maintenance_schedules",
  "reservations",
  "transfers",
  "checkouts",
  "checkoutsReceivedAsAsset",
  "componentCheckouts",
  "userAssets",
  "userAccessoires",
  "auditEntries",
  "items",
  "seatAssignments",
  "roles",
  "accounts",
  "sessions",
  "userHistory",
  "tickets",
  // Prevent reverts from changing org ownership
  "organizationId",
]);

/**
 * Sanitize a snapshot object: remove relation fields, the PK, and
 * auto-managed timestamps so only updatable scalar fields remain.
 */
function sanitizeSnapshot(
  data: Record<string, unknown>,
  idField: string,
): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === idField) continue;
    if (EXCLUDED_FIELDS.has(key)) continue;
    // Skip nested objects/arrays (relation data accidentally captured)
    if (Array.isArray(value)) continue;
    if (
      value !== null &&
      typeof value === "object" &&
      !(value instanceof Date)
    ) {
      // Allow Decimal-style objects like { toNumber: ... } — but skip plain objects
      if (!("toNumber" in (value as Record<string, unknown>))) continue;
    }
    clean[key] = value;
  }
  return clean;
}

// POST /api/admin/audit-logs/[id]/revert
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const admin = await requireApiAdmin();
    await requireWritableOrg(admin);
    const { id } = await params;

    // 1. Fetch the audit log entry, scoped to the caller's organization. A
    // caller without an organization owns no audit logs: never drop the
    // filter, it would let the revert reach any tenant's entry.
    const orgId = admin.organizationId;
    if (!orgId) {
      return NextResponse.json(
        { error: "Audit log entry not found" },
        { status: 404 },
      );
    }

    const auditLog = await prisma.audit_logs.findFirst({
      where: {
        id,
        // Scope through the user relation — audit_logs doesn't have organizationId directly
        user: { organizationId: orgId },
      },
    });

    if (!auditLog) {
      return NextResponse.json(
        { error: "Audit log entry not found" },
        { status: 404 },
      );
    }

    // 2. Parse details to get the before snapshot
    if (!auditLog.details) {
      return NextResponse.json(
        { error: "Cannot revert: no snapshot available" },
        { status: 400 },
      );
    }

    let parsed: {
      before?: Record<string, unknown> | null;
      after?: Record<string, unknown> | null;
      changes?: Record<string, unknown>;
    };
    try {
      parsed = JSON.parse(auditLog.details);
    } catch {
      return NextResponse.json(
        { error: "Cannot revert: details field is not valid JSON" },
        { status: 400 },
      );
    }

    if (!parsed.before) {
      return NextResponse.json(
        { error: "Cannot revert: no snapshot available" },
        { status: 400 },
      );
    }

    // 3. Only UPDATE actions can be reverted
    if (auditLog.action !== "UPDATE") {
      return NextResponse.json(
        { error: "Only UPDATE actions can be reverted" },
        { status: 400 },
      );
    }

    // 4. Resolve the Prisma model from the entity field
    const mapping = entityModelMap[auditLog.entity];
    if (!mapping) {
      return NextResponse.json(
        { error: `Unsupported entity type: ${auditLog.entity}` },
        { status: 400 },
      );
    }

    if (!auditLog.entityId) {
      return NextResponse.json(
        { error: "Cannot revert: no entity ID on audit log" },
        { status: 400 },
      );
    }

    // 5. Build sanitized data from the before snapshot
    const revertData = sanitizeSnapshot(parsed.before, mapping.idField);

    if (Object.keys(revertData).length === 0) {
      return NextResponse.json(
        { error: "Cannot revert: no revertable fields in snapshot" },
        { status: 400 },
      );
    }

    // A snapshot must not point the record at another tenant's rows.
    const foreign = await findForeignReference(
      orgId,
      snapshotReferences(revertData),
    );
    if (foreign) {
      return NextResponse.json(foreignReferenceError(foreign), {
        status: 400,
      });
    }

    // 6. Fetch the current state so we can log the revert diff
    interface RevertableModel {
      findFirst: (args: {
        where: Record<string, unknown>;
      }) => Promise<Record<string, unknown> | null>;
      updateMany: (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<{ count: number }>;
    }
    function getRevertableModel(name: string): RevertableModel | undefined {
      if (!(name in prisma)) return undefined;
      const delegate: unknown = prisma[name as keyof typeof prisma];
      if (
        delegate &&
        typeof delegate === "object" &&
        "findFirst" in delegate &&
        "updateMany" in delegate
      ) {
        return delegate as RevertableModel;
      }
      return undefined;
    }
    const prismaModel = getRevertableModel(mapping.model);

    if (!prismaModel) {
      return NextResponse.json(
        { error: `Prisma model not found for entity: ${auditLog.entity}` },
        { status: 500 },
      );
    }

    // The log is scoped through its author; the target must be scoped too, so
    // a record that has since left the organization reads as gone.
    const targetWhere = {
      [mapping.idField]: auditLog.entityId,
      organizationId: orgId,
    };
    const notFound = () =>
      NextResponse.json(
        { error: "Cannot revert: the target record no longer exists" },
        { status: 404 },
      );

    const currentRecord = await prismaModel.findFirst({ where: targetWhere });
    if (!currentRecord) return notFound();

    // 7. Apply the revert
    const { count } = await prismaModel.updateMany({
      where: targetWhere,
      data: revertData,
    });
    if (count === 0) return notFound();

    // 8. Create a REVERT audit log entry
    await createAuditLog({
      userId: admin.id ?? null,
      action: "REVERT",
      entity: auditLog.entity,
      entityId: auditLog.entityId,
      details: {
        revertedAuditLogId: auditLog.id,
        before: currentRecord,
        after: revertData,
        originalAction: auditLog.action,
      },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/admin/audit-logs/[id]/revert error", { error });
    return NextResponse.json(
      { error: "Failed to revert change" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
