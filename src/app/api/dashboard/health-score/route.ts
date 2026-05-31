import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  getOrganizationContext,
  scopeToOrganization,
} from "@/lib/organization-context";
import {
  calculateDepreciation,
  type DepreciationMethod,
} from "@/lib/depreciation";
import {
  calculateHealthScore,
  frequencyToDays,
  type HealthLabel,
} from "@/lib/health-score";
import { cached } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const cacheKey = `health_score_dashboard:${orgId ?? "global"}`;

    const result = await cached(
      cacheKey,
      async () => {
        const assets = await prisma.asset.findMany({
          where: scopeToOrganization({}, orgId),
          select: {
            assetid: true,
            assetname: true,
            assettag: true,
            purchasedate: true,
            expectedEndOfLife: true,
            warrantyExpires: true,
            purchaseprice: true,
            assetcategorytypeid: true,
            creation_date: true,
          },
        });

        // Fetch depreciation settings (small table, fetch all)
        const depSettings = await prisma.depreciation_settings.findMany();
        const settingsMap = new Map(depSettings.map((s) => [s.categoryId, s]));

        const schedules = await prisma.maintenance_schedules.findMany({
          where: {
            asset: scopeToOrganization({}, orgId),
            isActive: true,
          },
          select: {
            assetId: true,
            frequency: true,
            maintenance_logs: {
              orderBy: { completedAt: "desc" },
              take: 1,
              select: { completedAt: true },
            },
          },
        });

        // Build a map: assetId -> { lastMaintenanceDate, frequencyDays }
        const maintenanceMap = new Map<
          string,
          { lastMaintenanceDate: Date | null; frequencyDays: number }
        >();
        for (const schedule of schedules) {
          const existing = maintenanceMap.get(schedule.assetId);
          const lastLog = schedule.maintenance_logs[0] ?? null;
          const freqDays = frequencyToDays(schedule.frequency);

          if (!existing) {
            maintenanceMap.set(schedule.assetId, {
              lastMaintenanceDate: lastLog?.completedAt ?? null,
              frequencyDays: freqDays,
            });
          } else {
            // Use the most frequent schedule and latest log
            if (freqDays < existing.frequencyDays) {
              existing.frequencyDays = freqDays;
            }
            if (
              lastLog?.completedAt &&
              (!existing.lastMaintenanceDate ||
                lastLog.completedAt > existing.lastMaintenanceDate)
            ) {
              existing.lastMaintenanceDate = lastLog.completedAt;
            }
          }
        }

        // Compute health scores
        const distribution: Record<HealthLabel, number> = {
          excellent: 0,
          good: 0,
          fair: 0,
          poor: 0,
          critical: 0,
        };

        const scored: {
          assetId: string;
          name: string;
          tag: string;
          score: number;
          label: HealthLabel;
        }[] = [];

        let totalScore = 0;

        for (const asset of assets) {
          // Compute depreciation percentage
          let percentDepreciated: number | null = null;
          const settings = asset.assetcategorytypeid
            ? settingsMap.get(asset.assetcategorytypeid)
            : null;

          if (
            settings &&
            asset.purchaseprice &&
            Number(asset.purchaseprice) > 0
          ) {
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

          const maintenance = maintenanceMap.get(asset.assetid);

          const healthResult = calculateHealthScore({
            purchaseDate: asset.purchasedate
              ? new Date(asset.purchasedate)
              : null,
            expectedEndOfLife: asset.expectedEndOfLife
              ? new Date(asset.expectedEndOfLife)
              : null,
            warrantyExpires: asset.warrantyExpires
              ? new Date(asset.warrantyExpires)
              : null,
            lastMaintenanceDate: maintenance?.lastMaintenanceDate ?? null,
            maintenanceFrequencyDays: maintenance?.frequencyDays ?? null,
            percentDepreciated,
          });

          distribution[healthResult.label]++;
          totalScore += healthResult.overall;

          scored.push({
            assetId: asset.assetid,
            name: asset.assetname,
            tag: asset.assettag,
            score: healthResult.overall,
            label: healthResult.label,
          });
        }

        // Sort by score ascending to get lowest-scoring assets
        scored.sort((a, b) => a.score - b.score);

        return {
          averageScore:
            assets.length > 0 ? Math.round(totalScore / assets.length) : 0,
          totalAssets: assets.length,
          distribution: [
            { label: "excellent" as const, count: distribution.excellent },
            { label: "good" as const, count: distribution.good },
            { label: "fair" as const, count: distribution.fair },
            { label: "poor" as const, count: distribution.poor },
            { label: "critical" as const, count: distribution.critical },
          ],
          lowestScoring: scored.slice(0, 5),
        };
      },
      2 * 60 * 1000, // 2-minute TTL
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("GET /api/dashboard/health-score error", { error });
    return NextResponse.json(
      { error: "Failed to calculate health scores" },
      { status: 500 },
    );
  }
}
