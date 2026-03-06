import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireApiAuth();

    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    // --- Lifecycle: acquisitions and disposals by month (last 12 months) ---
    const acquisitionsRaw = await prisma.asset.groupBy({
      by: ["creation_date"],
      where: {
        creation_date: { gte: twelveMonthsAgo },
      },
      _count: { assetid: true },
    });

    const disposedRaw = await prisma.asset.findMany({
      where: {
        statusType: {
          statustypename: { in: ["Disposed", "Archived"] },
        },
        change_date: { gte: twelveMonthsAgo },
      },
      select: {
        change_date: true,
      },
    });

    // Build month buckets for lifecycle
    const lifecycleMap = new Map<
      string,
      { acquisitions: number; disposals: number }
    >();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      lifecycleMap.set(key, { acquisitions: 0, disposals: 0 });
    }

    for (const row of acquisitionsRaw) {
      const d = new Date(row.creation_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (lifecycleMap.has(key)) {
        lifecycleMap.get(key)!.acquisitions += row._count.assetid;
      }
    }

    for (const row of disposedRaw) {
      if (row.change_date) {
        const d = new Date(row.change_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (lifecycleMap.has(key)) {
          lifecycleMap.get(key)!.disposals += 1;
        }
      }
    }

    const lifecycle = Array.from(lifecycleMap.entries()).map(
      ([month, data]) => ({
        month,
        acquisitions: data.acquisitions,
        disposals: data.disposals,
      }),
    );

    // --- Cost Breakdown: sum purchase prices by category across asset types ---
    const assetCosts = await prisma.asset.groupBy({
      by: ["assetcategorytypeid"],
      _sum: { purchaseprice: true },
      where: { assetcategorytypeid: { not: null } },
    });

    const accessoryCosts = await prisma.accessories.groupBy({
      by: ["accessoriecategorytypeid"],
      _sum: { purchaseprice: true },
    });

    const consumableCosts = await prisma.consumable.groupBy({
      by: ["consumablecategorytypeid"],
      _sum: { purchaseprice: true },
    });

    const licenceCosts = await prisma.licence.groupBy({
      by: ["licencecategorytypeid"],
      _sum: { purchaseprice: true },
    });

    // Fetch category names (only ID and name needed for mapping)
    const assetCategories = await prisma.assetCategoryType.findMany({
      select: { assetcategorytypeid: true, assetcategorytypename: true },
    });
    const accessoryCategories = await prisma.accessorieCategoryType.findMany({
      select: {
        accessoriecategorytypeid: true,
        accessoriecategorytypename: true,
      },
    });
    const consumableCategories = await prisma.consumableCategoryType.findMany({
      select: {
        consumablecategorytypeid: true,
        consumablecategorytypename: true,
      },
    });
    const licenceCategories = await prisma.licenceCategoryType.findMany({
      select: { licencecategorytypeid: true, licencecategorytypename: true },
    });

    const assetCatMap = new Map(
      assetCategories.map((c) => [
        c.assetcategorytypeid,
        c.assetcategorytypename,
      ]),
    );
    const accCatMap = new Map(
      accessoryCategories.map((c) => [
        c.accessoriecategorytypeid,
        c.accessoriecategorytypename,
      ]),
    );
    const conCatMap = new Map(
      consumableCategories.map((c) => [
        c.consumablecategorytypeid,
        c.consumablecategorytypename,
      ]),
    );
    const licCatMap = new Map(
      licenceCategories.map((c) => [
        c.licencecategorytypeid,
        c.licencecategorytypename,
      ]),
    );

    // Collect all unique category names
    const costMap = new Map<
      string,
      {
        assets: number;
        accessories: number;
        consumables: number;
        licences: number;
      }
    >();

    const ensureCategory = (name: string) => {
      if (!costMap.has(name)) {
        costMap.set(name, {
          assets: 0,
          accessories: 0,
          consumables: 0,
          licences: 0,
        });
      }
    };

    for (const row of assetCosts) {
      const name = assetCatMap.get(row.assetcategorytypeid!) || "Unknown";
      ensureCategory(name);
      costMap.get(name)!.assets = Number(row._sum.purchaseprice || 0);
    }

    for (const row of accessoryCosts) {
      const name = accCatMap.get(row.accessoriecategorytypeid) || "Unknown";
      ensureCategory(name);
      costMap.get(name)!.accessories = Number(row._sum.purchaseprice || 0);
    }

    for (const row of consumableCosts) {
      const name = conCatMap.get(row.consumablecategorytypeid) || "Unknown";
      ensureCategory(name);
      costMap.get(name)!.consumables = Number(row._sum.purchaseprice || 0);
    }

    for (const row of licenceCosts) {
      const name = licCatMap.get(row.licencecategorytypeid) || "Unknown";
      ensureCategory(name);
      costMap.get(name)!.licences = Number(row._sum.purchaseprice || 0);
    }

    const costBreakdown = Array.from(costMap.entries()).map(
      ([category, data]) => ({
        category,
        ...data,
      }),
    );

    // --- Location Distribution: count assets per location ---
    const locationCounts = await prisma.asset.groupBy({
      by: ["locationid"],
      _count: { assetid: true },
      where: { locationid: { not: null } },
    });

    const locations = await prisma.location.findMany({
      select: { locationid: true, locationname: true },
    });
    const locationNameMap = new Map(
      locations.map((l) => [l.locationid, l.locationname || "Unknown"]),
    );

    const locationDistribution = locationCounts.map((row) => ({
      name: locationNameMap.get(row.locationid!) || "Unknown",
      value: row._count.assetid,
    }));

    // --- Maintenance Trend: count maintenance logs by month (last 12 months) ---
    const maintenanceRaw = await prisma.maintenance_logs.findMany({
      where: {
        completedAt: { gte: twelveMonthsAgo },
      },
      select: {
        completedAt: true,
      },
    });

    const maintenanceMap = new Map<string, number>();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      maintenanceMap.set(key, 0);
    }

    for (const row of maintenanceRaw) {
      const d = new Date(row.completedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (maintenanceMap.has(key)) {
        maintenanceMap.set(key, maintenanceMap.get(key)! + 1);
      }
    }

    const maintenanceTrend = Array.from(maintenanceMap.entries()).map(
      ([month, count]) => ({
        month,
        count,
      }),
    );

    // --- Depreciation Forecast ---
    const depreciationSettings = await prisma.depreciation_settings.findMany({
      include: {
        assetCategoryType: {
          include: {
            asset: {
              select: {
                assetid: true,
                purchaseprice: true,
                purchasedate: true,
              },
            },
          },
        },
      },
    });

    let currentTotal = 0;
    const yearProjections = new Map<string, number>();

    // Initialize projection years
    const currentYear = now.getFullYear();
    for (let y = 0; y <= 3; y++) {
      yearProjections.set(String(currentYear + y), 0);
    }

    for (const setting of depreciationSettings) {
      const usefulLifeYears = setting.usefulLifeYears;
      const salvagePercent = Number(setting.salvagePercent);

      for (const asset of setting.assetCategoryType.asset) {
        const purchasePrice = Number(asset.purchaseprice || 0);
        if (purchasePrice === 0 || !asset.purchasedate) continue;

        const salvageValue = purchasePrice * (salvagePercent / 100);
        const depreciableAmount = purchasePrice - salvageValue;
        const annualDepreciation = depreciableAmount / usefulLifeYears;
        const purchaseDate = new Date(asset.purchasedate);

        for (let y = 0; y <= 3; y++) {
          const targetYear = currentYear + y;
          const yearsElapsed =
            targetYear -
            purchaseDate.getFullYear() +
            (now.getMonth() - purchaseDate.getMonth()) / 12;
          const totalDepreciation = Math.min(
            annualDepreciation * Math.max(yearsElapsed, 0),
            depreciableAmount,
          );
          const currentValue = Math.max(
            purchasePrice - totalDepreciation,
            salvageValue,
          );
          const yearKey = String(targetYear);

          yearProjections.set(
            yearKey,
            (yearProjections.get(yearKey) || 0) + currentValue,
          );
        }
      }
    }

    currentTotal = yearProjections.get(String(currentYear)) || 0;

    const projections = Array.from(yearProjections.entries()).map(
      ([year, value]) => ({
        year,
        value: Math.round(value * 100) / 100,
      }),
    );

    const depreciationForecast = {
      currentTotal: Math.round(currentTotal * 100) / 100,
      projections,
    };

    return NextResponse.json({
      lifecycle,
      costBreakdown,
      locationDistribution,
      maintenanceTrend,
      depreciationForecast,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    logger.error("Advanced reports error", { error });
    return NextResponse.json(
      { error: "Failed to generate advanced reports" },
      { status: 500 },
    );
  }
}
