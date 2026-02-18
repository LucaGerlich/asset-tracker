import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { getGDPRSettings } from "@/lib/gdpr-settings";

/**
 * GET /api/admin/compliance
 * Returns compliance status data for SOX/HIPAA reporting dashboard.
 */
export async function GET() {
  try {
    await requireApiAdmin();

    // --- Access Control ---
    const [totalUsers, adminUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isadmin: true } }),
    ]);

    // --- Audit Coverage ---
    // Count distinct entities that have at least one audit log entry in the last 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const [
      totalAssets,
      totalAccessories,
      totalLicences,
      totalConsumables,
      auditedEntitiesRaw,
      totalAuditLogs,
      lastAuditLogEntry,
    ] = await Promise.all([
      prisma.asset.count(),
      prisma.accessories.count(),
      prisma.licence.count(),
      prisma.consumable.count(),
      prisma.audit_logs.findMany({
        where: {
          createdAt: { gte: ninetyDaysAgo },
          entityId: { not: null },
        },
        select: { entityId: true },
        distinct: ["entityId"],
      }),
      prisma.audit_logs.count(),
      prisma.audit_logs.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const totalEntities = totalAssets + totalAccessories + totalLicences + totalConsumables;
    const auditedEntityCount = auditedEntitiesRaw.length;

    // --- Data Retention / GDPR ---
    const gdprSettings = getGDPRSettings();
    const gdprConfigured = gdprSettings.updatedAt !== null;

    // --- Asset Inventory Breakdown ---
    // Count assets grouped by status type
    const statusCounts = await prisma.asset.groupBy({
      by: ["statustypeid"],
      _count: { assetid: true },
    });

    // Look up status type names for the grouped results
    const statusTypeIds = statusCounts
      .map((sc) => sc.statustypeid)
      .filter((id): id is string => id !== null);

    const statusTypes = statusTypeIds.length > 0
      ? await prisma.statusType.findMany({
          where: { statustypeid: { in: statusTypeIds } },
          select: { statustypeid: true, statustypename: true },
        })
      : [];

    const statusMap = new Map(
      statusTypes.map((st) => [st.statustypeid, st.statustypename])
    );

    // Determine active vs retired counts
    let activeAssets = 0;
    let retiredAssets = 0;
    for (const sc of statusCounts) {
      const name = sc.statustypeid ? statusMap.get(sc.statustypeid)?.toLowerCase() : null;
      if (name === "active" || name === "available" || name === "deployed") {
        activeAssets += sc._count.assetid;
      } else if (name === "retired" || name === "disposed" || name === "archived") {
        retiredAssets += sc._count.assetid;
      }
    }

    return NextResponse.json({
      accessControl: {
        totalUsers,
        adminUsers,
        regularUsers: totalUsers - adminUsers,
      },
      auditCoverage: {
        totalEntities,
        auditedEntities: auditedEntityCount,
        coveragePercent:
          totalEntities > 0
            ? Math.round((auditedEntityCount / totalEntities) * 100)
            : 0,
        totalAuditLogs,
        lastActivityDate: lastAuditLogEntry?.createdAt ?? null,
      },
      dataRetention: {
        gdprConfigured,
        auditLogRetentionDays: gdprSettings.auditLogRetentionDays,
        deletedUserRetentionDays: gdprSettings.deletedUserRetentionDays,
        exportRetentionDays: gdprSettings.exportRetentionDays,
        lastUpdated: gdprSettings.updatedAt,
      },
      assetInventory: {
        totalAssets,
        activeAssets,
        retiredAssets,
        otherAssets: totalAssets - activeAssets - retiredAssets,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/compliance error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to fetch compliance data" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
