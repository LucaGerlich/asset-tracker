import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { createAuditLog, AUDIT_ACTIONS } from "@/lib/audit-log";
import { randomUUID } from "crypto";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/**
 * POST /api/admin/gdpr/anonymize/[userId]
 * Anonymize a user's personal data (right to be forgotten).
 * Uses a transaction to atomically update all relevant records.
 */
export async function POST(req: Request, { params }: RouteParams) {
  try {
    const adminUser = await requireApiAdmin();
    const { userId } = await params;

    // Verify the user exists
    const targetUser = await prisma.user.findUnique({
      where: { userid: userId },
      select: {
        userid: true,
        firstname: true,
        lastname: true,
        email: true,
        username: true,
        isadmin: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Prevent anonymizing admin users without explicit confirmation
    if (targetUser.isadmin) {
      return NextResponse.json(
        { error: "Cannot anonymize admin users. Remove admin privileges first." },
        { status: 400 }
      );
    }

    // Prevent self-anonymization
    if (adminUser.id === userId) {
      return NextResponse.json(
        { error: "Cannot anonymize your own account." },
        { status: 400 }
      );
    }

    const anonymizedEmail = `deleted-${randomUUID()}@anonymized.local`;

    await prisma.$transaction(async (tx) => {
      // 1. Anonymize the user record
      await tx.user.update({
        where: { userid: userId },
        data: {
          firstname: "[Deleted]",
          lastname: "User",
          email: anonymizedEmail,
          username: null,
        },
      });

      // 2. Delete user preferences
      await tx.user_preferences.deleteMany({
        where: { userId },
      });

      // 3. Anonymize audit logs: remove PII from details but keep log entries
      const userAuditLogs = await tx.audit_logs.findMany({
        where: { userId },
        select: { id: true, details: true },
      });

      for (const log of userAuditLogs) {
        let sanitizedDetails: string | null = null;
        if (log.details) {
          try {
            const parsed = JSON.parse(log.details);
            // Remove common PII fields from details
            const piiFields = [
              "email", "firstname", "lastname", "username",
              "name", "fullName", "phone", "address",
            ];
            for (const field of piiFields) {
              if (field in parsed) {
                parsed[field] = "[REDACTED]";
              }
            }
            // Also handle nested changes object
            if (parsed.changes && typeof parsed.changes === "object") {
              for (const field of piiFields) {
                if (field in parsed.changes) {
                  parsed.changes[field] = "[REDACTED]";
                }
              }
            }
            sanitizedDetails = JSON.stringify(parsed);
          } catch {
            sanitizedDetails = "[REDACTED]";
          }
        }

        await tx.audit_logs.update({
          where: { id: log.id },
          data: {
            details: sanitizedDetails,
            userAgent: null,
            ipAddress: null,
          },
        });
      }
    });

    // Create an audit log entry for the anonymization action itself
    await createAuditLog({
      userId: adminUser.id || null,
      action: AUDIT_ACTIONS.DELETE,
      entity: "gdpr",
      entityId: userId,
      details: {
        type: "user_anonymization",
        targetUserId: userId,
        anonymizedEmail,
      },
    });

    return NextResponse.json({
      success: true,
      message: `User ${userId} has been anonymized.`,
    });
  } catch (error) {
    console.error("POST /api/admin/gdpr/anonymize/[userId] error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to anonymize user data" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
