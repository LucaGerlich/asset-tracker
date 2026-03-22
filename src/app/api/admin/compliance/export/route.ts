import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import { getGDPRSettings } from "@/lib/gdpr-settings";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/compliance/export
 * Generates a compliance audit report as a downloadable JSON file.
 * Includes: user access list, admin users, audit log summary stats,
 * asset count, and data retention settings.
 */
export async function GET() {
  try {
    const adminUser = await requireApiAdmin();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const orgScope = scopeToOrganization({}, orgId);

    // --- User Access List (scoped to organization) ---
    const users = await prisma.user.findMany({
      where: orgScope,
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

    const adminUsersList = users.filter((u) => u.isadmin);
    const regularUsersList = users.filter((u) => !u.isadmin);

    // --- Audit Log Summary ---
    const [totalAuditLogs, lastAuditEntry, oldestAuditEntry] =
      await Promise.all([
        prisma.audit_logs.count(),
        prisma.audit_logs.findFirst({
          orderBy: { createdAt: "desc" },
          select: { createdAt: true, action: true, entity: true },
        }),
        prisma.audit_logs.findFirst({
          orderBy: { createdAt: "asc" },
          select: { createdAt: true },
        }),
      ]);

    // Audit logs by action type
    const auditByAction = await prisma.audit_logs.groupBy({
      by: ["action"],
      _count: { id: true },
    });

    // Audit logs by entity type
    const auditByEntity = await prisma.audit_logs.groupBy({
      by: ["entity"],
      _count: { id: true },
    });

    // --- Asset Counts (scoped to organization) ---
    const [totalAssets, totalAccessories, totalLicences, totalConsumables] =
      await Promise.all([
        prisma.asset.count({ where: orgScope }),
        prisma.accessories.count({ where: orgScope }),
        prisma.licence.count({ where: orgScope }),
        prisma.consumable.count({ where: orgScope }),
      ]);

    // --- Data Retention Settings ---
    const gdprSettings = getGDPRSettings();

    // --- Build Report ---
    const report = {
      reportMetadata: {
        generatedAt: new Date().toISOString(),
        generatedBy: adminUser.username || adminUser.email || adminUser.id,
        reportType: "Compliance Audit Report",
        version: "1.0",
      },
      accessControl: {
        totalUsers: users.length,
        adminCount: adminUsersList.length,
        regularUserCount: regularUsersList.length,
        adminUsers: adminUsersList.map((u) => ({
          id: u.userid,
          name: `${u.firstname} ${u.lastname}`,
          email: u.email,
          username: u.username,
          createdAt: u.creation_date,
        })),
        userAccessList: users.map((u) => ({
          id: u.userid,
          name: `${u.firstname} ${u.lastname}`,
          email: u.email,
          isAdmin: u.isadmin,
          canRequest: u.canrequest,
          createdAt: u.creation_date,
        })),
      },
      auditLogSummary: {
        totalEntries: totalAuditLogs,
        oldestEntry: oldestAuditEntry?.createdAt ?? null,
        newestEntry: lastAuditEntry?.createdAt ?? null,
        lastAction: lastAuditEntry
          ? { action: lastAuditEntry.action, entity: lastAuditEntry.entity }
          : null,
        entriesByAction: auditByAction.map((a) => ({
          action: a.action,
          count: a._count.id,
        })),
        entriesByEntity: auditByEntity.map((e) => ({
          entity: e.entity,
          count: e._count.id,
        })),
      },
      assetInventory: {
        totalAssets,
        totalAccessories,
        totalLicences,
        totalConsumables,
        grandTotal:
          totalAssets + totalAccessories + totalLicences + totalConsumables,
      },
      dataRetention: {
        gdprConfigured: gdprSettings.updatedAt !== null,
        settings: {
          auditLogRetentionDays: gdprSettings.auditLogRetentionDays,
          deletedUserRetentionDays: gdprSettings.deletedUserRetentionDays,
          exportRetentionDays: gdprSettings.exportRetentionDays,
        },
        lastUpdated: gdprSettings.updatedAt,
      },
    };

    const filename = `compliance-report-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    logger.error("GET /api/admin/compliance/export error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to generate compliance report" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
