import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  calculateDepreciation,
  type DepreciationMethod,
} from "@/lib/depreciation";
import { calculateHealthScore, frequencyToDays } from "@/lib/health-score";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;
    const { id } = await params;

    const asset = await prisma.asset.findFirst({
      where: scopeToOrganization({ assetid: id }, orgId),
      select: {
        assetid: true,
        purchasedate: true,
        expectedEndOfLife: true,
        warrantyExpires: true,
        purchaseprice: true,
        assetcategorytypeid: true,
        creation_date: true,
      },
    });

    if (!asset) {
      return NextResponse.json({ error: "Asset not found" }, { status: 404 });
    }

    // Depreciation
    let percentDepreciated: number | null = null;
    const settings = asset.assetcategorytypeid
      ? await prisma.depreciation_settings.findUnique({
          where: { categoryId: asset.assetcategorytypeid },
        })
      : null;

    if (settings && asset.purchaseprice && Number(asset.purchaseprice) > 0) {
      const purchaseDate = asset.purchasedate ?? asset.creation_date;
      if (purchaseDate) {
        const depResult = calculateDepreciation({
          purchasePrice: Number(asset.purchaseprice),
          purchaseDate: new Date(purchaseDate),
          method: settings.method as DepreciationMethod,
          usefulLifeYears: settings.usefulLifeYears,
          salvagePercent: Number(settings.salvagePercent),
        });
        percentDepreciated = depResult.percentDepreciated;
      }
    }

    // Maintenance
    const schedules = await prisma.maintenance_schedules.findMany({
      where: { assetId: id, isActive: true },
      select: {
        frequency: true,
        maintenance_logs: {
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
      },
    });

    let lastMaintenanceDate: Date | null = null;
    let maintenanceFrequencyDays: number | null = null;

    if (schedules.length > 0) {
      // Use the most frequent schedule
      maintenanceFrequencyDays = Math.min(
        ...schedules.map((s) => frequencyToDays(s.frequency)),
      );
      // Use the most recent log across all schedules
      for (const schedule of schedules) {
        const log = schedule.maintenance_logs[0];
        if (
          log?.completedAt &&
          (!lastMaintenanceDate || log.completedAt > lastMaintenanceDate)
        ) {
          lastMaintenanceDate = log.completedAt;
        }
      }
    }

    const result = calculateHealthScore({
      purchaseDate: asset.purchasedate ? new Date(asset.purchasedate) : null,
      expectedEndOfLife: asset.expectedEndOfLife
        ? new Date(asset.expectedEndOfLife)
        : null,
      warrantyExpires: asset.warrantyExpires
        ? new Date(asset.warrantyExpires)
        : null,
      lastMaintenanceDate,
      maintenanceFrequencyDays,
      percentDepreciated,
    });

    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/assets/[id]/health-score error", { error });
    return NextResponse.json(
      { error: "Failed to calculate health score" },
      { status: 500 },
    );
  }
}
