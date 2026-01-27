import prisma from "@/lib/prisma";
import { headers } from "next/headers";

/**
 * Create an audit log entry
 * @param {Object} params - Audit log parameters
 * @param {string} params.userId - User ID performing the action
 * @param {string} params.action - Action performed (e.g., "CREATE", "UPDATE", "DELETE")
 * @param {string} params.entity - Entity type (e.g., "user", "asset", "accessory")
 * @param {string} params.entityId - ID of the entity affected
 * @param {Object} params.details - Additional details about the action
 */
export async function createAuditLog({ userId, action, entity, entityId, details }) {
  try {
    const headersList = await headers();
    const ipAddress = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const userAgent = headersList.get("user-agent") || "unknown";

    await prisma.auditLog.create({
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
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of logs to return
 * @param {string} options.userId - Filter by user ID
 * @param {string} options.entity - Filter by entity type
 * @param {string} options.action - Filter by action
 * @returns {Promise<Array>} Array of audit logs
 */
export async function getAuditLogs({ limit = 50, userId, entity, action } = {}) {
  const where = {};

  if (userId) where.userId = userId;
  if (entity) where.entity = entity;
  if (action) where.action = action;

  return await prisma.auditLog.findMany({
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
};

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
};
