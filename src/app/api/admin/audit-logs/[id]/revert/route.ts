import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { createAuditLog } from "@/lib/audit-log";
import { getOrganizationContext } from "@/lib/organization-context";

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
  component: { model: "Component", idField: "id" },
  kit: { model: "Kit", idField: "id" },
};

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
    const { id } = await params;

    // 1. Fetch the audit log entry, scoped to the caller's organization
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const auditLog = await prisma.audit_logs.findFirst({
      where: {
        id,
        // Scope through the user relation — audit_logs doesn't have organizationId directly
        ...(orgId ? { user: { organizationId: orgId } } : {}),
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

    // 6. Fetch the current state so we can log the revert diff
    const prismaModel = (prisma as unknown as Record<string, unknown>)[
      mapping.model
    ] as {
      findUnique: (args: {
        where: Record<string, unknown>;
      }) => Promise<Record<string, unknown> | null>;
      update: (args: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => Promise<Record<string, unknown>>;
    };

    if (!prismaModel) {
      return NextResponse.json(
        { error: `Prisma model not found for entity: ${auditLog.entity}` },
        { status: 500 },
      );
    }

    const currentRecord = await prismaModel.findUnique({
      where: { [mapping.idField]: auditLog.entityId },
    });

    if (!currentRecord) {
      return NextResponse.json(
        { error: "Cannot revert: the target record no longer exists" },
        { status: 404 },
      );
    }

    // 7. Apply the revert
    await prismaModel.update({
      where: { [mapping.idField]: auditLog.entityId },
      data: revertData,
    });

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
    console.error("POST /api/admin/audit-logs/[id]/revert error", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to revert change" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
