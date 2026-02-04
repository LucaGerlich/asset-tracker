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
export async function createAuditLog({ userId, action, entity, entityId, details }: AuditLogParams): Promise<void> {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
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
export async function getAuditLogs({ limit = 50, userId, entity, action }: GetAuditLogsOptions = {}) {
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
  ASSET_CATEGORY: "asset_category",
  ACCESSORY_CATEGORY: "accessory_category",
  CONSUMABLE_CATEGORY: "consumable_category",
  LICENCE_CATEGORY: "licence_category",
  MODEL: "model",
  STATUS_TYPE: "status_type",
} as const;
