import { NextResponse } from "next/server";
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
import type { TCOCategoryBreakdown, TCOSummary } from "@/lib/tco";
import { cached } from "@/lib/cache";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAuth();
    const orgCtx = await getOrganizationContext();
    const orgId = orgCtx?.organization?.id;

    const cacheKey = `tco_dashboard:${orgId ?? "global"}`;

    const result = await cached(
      cacheKey,
      async () => {
        // 1. Purchase costs grouped by category
        const purchaseGroups = await prisma.asset.groupBy({
          by: ["assetcategorytypeid"],
          _sum: { purchaseprice: true },
          _count: { assetid: true },
          where: scopeToOrganization({}, orgId),
        });

        // 2. Maintenance actual costs — fetch logs with schedule -> asset -> category
        const maintenanceLogs = await prisma.maintenance_logs.findMany({
          where: {
            actualCost: { not: null },
            maintenance_schedules: {
              asset: scopeToOrganization({}, orgId),
            },
          },
          select: {
            actualCost: true,
            maintenance_schedules: {
              select: {
                asset: {
                  select: { assetcategorytypeid: true },
                },
              },
            },
          },
        });

        // Aggregate maintenance costs by category
        const maintenanceByCat = new Map<string | null, number>();
        for (const log of maintenanceLogs) {
          const catId =
            log.maintenance_schedules.asset.assetcategorytypeid ?? null;
          const cost = Number(log.actualCost) || 0;
          maintenanceByCat.set(
            catId,
            (maintenanceByCat.get(catId) ?? 0) + cost,
          );
        }

        // 3. Depreciation per asset, grouped by category
        const assets = await prisma.asset.findMany({
          where: scopeToOrganization({ purchaseprice: { not: null } }, orgId),
          select: {
            purchaseprice: true,
            purchasedate: true,
            creation_date: true,
            assetcategorytypeid: true,
          },
        });

        const depSettings = await prisma.depreciation_settings.findMany();
        const settingsMap = new Map(depSettings.map((s) => [s.categoryId, s]));

        const depByCat = new Map<
          string | null,
          { accDep: number; currentVal: number }
        >();
        for (const asset of assets) {
          const catId = asset.assetcategorytypeid ?? null;
          const price = Number(asset.purchaseprice);
          if (!price || price <= 0) continue;

          const settings = catId ? settingsMap.get(catId) : null;
          let accDep = 0;
          let currentVal = price;

          if (settings) {
            const purchaseDate = asset.purchasedate ?? asset.creation_date;
            if (purchaseDate) {
              const result = calculateDepreciation({
                purchasePrice: price,
                purchaseDate: new Date(purchaseDate),
                method: settings.method as DepreciationMethod,
                usefulLifeYears: settings.usefulLifeYears,
                salvagePercent: Number(settings.salvagePercent),
              });
              accDep = result.accumulatedDepreciation;
              currentVal = result.currentValue;
            }
          }

          const existing = depByCat.get(catId) ?? {
            accDep: 0,
            currentVal: 0,
          };
          existing.accDep += accDep;
          existing.currentVal += currentVal;
          depByCat.set(catId, existing);
        }

        // 4. Licence total (fleet-level)
        const licenceAgg = await prisma.licence.aggregate({
          _sum: { purchaseprice: true },
          where: scopeToOrganization({}, orgId),
        });
        const totalLicenceCost = Number(licenceAgg._sum.purchaseprice) || 0;

        // 5. Category names
        const categories = await prisma.assetCategoryType.findMany({
          select: {
            assetcategorytypeid: true,
            assetcategorytypename: true,
          },
        });
        const catNameMap = new Map(
          categories.map((c) => [
            c.assetcategorytypeid,
            c.assetcategorytypename,
          ]),
        );

        // 6. Combine into per-category breakdown
        const allCatIds = new Set<string | null>();
        for (const g of purchaseGroups) allCatIds.add(g.assetcategorytypeid);
        for (const [k] of maintenanceByCat) allCatIds.add(k);
        for (const [k] of depByCat) allCatIds.add(k);

        let totalPurchaseCost = 0;
        let totalMaintenanceCost = 0;
        let totalDepreciationLoss = 0;
        let totalCurrentValue = 0;

        const byCategory: TCOCategoryBreakdown[] = [];

        for (const catId of allCatIds) {
          const purchaseGroup = purchaseGroups.find(
            (g) => g.assetcategorytypeid === catId,
          );
          const purchaseCost = Number(purchaseGroup?._sum.purchaseprice) || 0;
          const assetCount = purchaseGroup?._count.assetid ?? 0;
          const maintenanceCost = maintenanceByCat.get(catId) ?? 0;
          const dep = depByCat.get(catId) ?? {
            accDep: 0,
            currentVal: 0,
          };

          totalPurchaseCost += purchaseCost;
          totalMaintenanceCost += maintenanceCost;
          totalDepreciationLoss += dep.accDep;
          totalCurrentValue += dep.currentVal;

          byCategory.push({
            categoryId: catId,
            categoryName: catId
              ? (catNameMap.get(catId) ?? "Unknown")
              : "Uncategorized",
            assetCount,
            purchaseCost: Math.round(purchaseCost * 100) / 100,
            maintenanceCost: Math.round(maintenanceCost * 100) / 100,
            depreciationLoss: Math.round(dep.accDep * 100) / 100,
            currentValue: Math.round(dep.currentVal * 100) / 100,
            totalCostOfOwnership:
              Math.round((purchaseCost + maintenanceCost) * 100) / 100,
          });
        }

        // Sort by TCO descending
        byCategory.sort(
          (a, b) => b.totalCostOfOwnership - a.totalCostOfOwnership,
        );

        const summary: TCOSummary = {
          totalPurchaseCost: Math.round(totalPurchaseCost * 100) / 100,
          totalMaintenanceCost: Math.round(totalMaintenanceCost * 100) / 100,
          totalDepreciationLoss: Math.round(totalDepreciationLoss * 100) / 100,
          totalCurrentValue: Math.round(totalCurrentValue * 100) / 100,
          totalLicenceCost: Math.round(totalLicenceCost * 100) / 100,
          grandTotal:
            Math.round(
              (totalPurchaseCost + totalMaintenanceCost + totalLicenceCost) *
                100,
            ) / 100,
          byCategory,
        };

        return summary;
      },
      2 * 60 * 1000, // 2-minute TTL
    );

    return NextResponse.json(result);
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/dashboard/tco error", { error });
    return NextResponse.json(
      { error: "Failed to calculate TCO" },
      { status: 500 },
    );
  }
}
