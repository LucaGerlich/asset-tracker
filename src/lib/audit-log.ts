import prisma from "@/lib/prisma";
import { headers } from "next/headers";

interface AuditLogParams {
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  details?: Record<string, unknown>;
}

interface GetAuditLogsOptions {
  limit?: number;
  userId?: string;
  entity?: string;
  action?: string;
}

interface AuditLogWhereInput {
  userId?: string;
  entity?: string;
  action?: string;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog({
  userId,
  action,
  entity,
  entityId,
  details,
}: AuditLogParams): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress =
      headersList.get("x-forwarded-for") ||
      headersList.get("x-real-ip") ||
      "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await prisma.audit_logs.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId || null,
        details: details ? JSON.stringify(details) : null,
        ipAddress: ipAddress.split(",")[0].trim(), // Get first IP if multiple
        userAgent: userAgent.slice(0, 255), // Truncate if too long
      },
    });
  } catch (error) {
    // Log error but don't throw - audit logging shouldn't break the application
    console.error("Failed to create audit log:", error);
  }
}

/**
 * Get recent audit logs
 */
export async function getAuditLogs({
  limit = 50,
  userId,
  entity,
  action,
}: GetAuditLogsOptions = {}) {
  const where: AuditLogWhereInput = {};

  if (userId) where.userId = userId;
  if (entity) where.entity = entity;
  if (action) where.action = action;

  return await prisma.audit_logs.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });
}

/**
 * Compute the diff between two objects, returning only the fields that changed.
 * Uses JSON.stringify for deep equality comparison.
 */
export function computeDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const diff: Record<string, { from: unknown; to: unknown }> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const fromVal = before[key];
    const toVal = after[key];

    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      diff[key] = { from: fromVal ?? null, to: toVal ?? null };
    }
  }

  return diff;
}

interface AuditLogWithDiffParams extends AuditLogParams {
  before: Record<string, unknown>;
  after: Record<string, unknown>;
}

/**
 * Create an audit log entry that includes a diff of changed fields.
 * The diff is stored in the `details` JSON field under the `changes` key.
 */
export async function createAuditLogWithDiff({
  before,
  after,
  details,
  ...rest
}: AuditLogWithDiffParams): Promise<void> {
  const changes = computeDiff(before, after);

  await createAuditLog({
    ...rest,
    details: {
      changes,
      ...details,
    },
  });
}

/**
 * Common audit actions
 */
export const AUDIT_ACTIONS = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  LOGIN_FAILED: "LOGIN_FAILED",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  ASSIGN: "ASSIGN",
  UNASSIGN: "UNASSIGN",
  REQUEST: "REQUEST",
  APPROVE: "APPROVE",
  REJECT: "REJECT",
  SECURITY_ALERT: "SECURITY_ALERT",
} as const;

/**
 * Common entity types
 */
export const AUDIT_ENTITIES = {
  USER: "user",
  ASSET: "asset",
  ACCESSORY: "accessory",
  LICENSE: "license",
  MANUFACTURER: "manufacturer",
  SUPPLIER: "supplier",
  LOCATION: "location",
  CONSUMABLE: "consumable",
  COMPONENT: "component",
  COMPONENT_CATEGORY: "component_category",
  ASSET_CATEGORY: "asset_category",
  ACCESSORY_CATEGORY: "accessory_category",
  CONSUMABLE_CATEGORY: "consumable_category",
  LICENCE_CATEGORY: "licence_category",
  MODEL: "model",
  STATUS_TYPE: "status_type",
  LICENCE_SEAT: "licence_seat",
  EULA_TEMPLATE: "eula_template",
  KIT: "kit",
  AUDIT_CAMPAIGN: "audit_campaign",
} as const;
