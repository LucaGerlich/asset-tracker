import {
  getAssetCount,
  getUserCount,
  getAccessoryCount,
  getAssetStatusDistribution,
  getAccessoryStatusDistribution,
  getStatus,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";
import AssetStatusChart from "@/components/charts/AssetStatusChart";
import DismissibleHelpTip from "@/components/DismissibleHelpTip";
import DashboardGrid from "@/components/dashboard/DashboardGrid";
import UserDashboard from "@/components/dashboard/UserDashboard";
import { getOrganizationContext } from "@/lib/organization-context";
import prisma from "@/lib/prisma";
import { Suspense } from "react";
import AssetMapClient from "@/components/maps/AssetMapClient";

export const metadata = {
  title: "Asset Tracker - Dashboard",
};

export default async function DashboardPage() {
  let ctx: Awaited<ReturnType<typeof getOrganizationContext>> = null;
  try {
    ctx = await getOrganizationContext();
  } catch {
    // No session — will show admin dashboard with defaults
  }
  const isAdmin = ctx?.isAdmin ?? true;

  if (!isAdmin && ctx?.userId) {
    return <UserDashboard userId={ctx.userId} />;
  }

  const [
    userCount,
    assetCount,
    accessoryCount,
    statusDistribution,
    accessoryStatusDistribution,
    statuses,
  ] = await Promise.all([
    getUserCount(),
    getAssetCount(),
    getAccessoryCount(),
    getAssetStatusDistribution(),
    getAccessoryStatusDistribution(),
    getStatus(),
  ]);

  // Map query is separate — gracefully handles missing columns
  let mapLocations: Array<{
    id: string;
    name: string | null;
    latitude: number;
    longitude: number;
    assetCount: number;
  }> = [];
  try {
    const locationsWithCoords = await prisma.location.findMany({
      where: { latitude: { not: null }, longitude: { not: null } },
      select: {
        locationid: true,
        locationname: true,
        latitude: true,
        longitude: true,
        _count: { select: { asset: true } },
        children: {
          select: {
            _count: { select: { asset: true } },
            children: {
              select: { _count: { select: { asset: true } } },
            },
          },
        },
      },
    });
    mapLocations = locationsWithCoords.map((loc) => {
      // Sum assets at this location + all children + grandchildren
      let total = loc._count.asset;
      for (const child of loc.children) {
        total += child._count.asset;
        for (const grandchild of child.children) {
          total += grandchild._count.asset;
        }
      }
      return {
        id: loc.locationid,
        name: loc.locationname,
        latitude: loc.latitude!,
        longitude: loc.longitude!,
        assetCount: total,
      };
    });
  } catch {
    // latitude/longitude columns may not exist yet
  }

  const statusCounts = new Map<string, number>();
  let totalCounted = 0;

  statusDistribution.forEach((entry) => {
    const key = entry.statustypeid ?? "__unassigned";
    statusCounts.set(key, entry.count);
    totalCounted += entry.count;
  });

  const chartData = [];

  statuses.forEach((status) => {
    const count = statusCounts.get(status.statustypeid) ?? 0;
    chartData.push({ name: status.statustypename ?? "Unknown", value: count });
  });

  const unassignedCount = statusCounts.get("__unassigned");
  if (unassignedCount) {
    chartData.push({ name: "Unassigned", value: unassignedCount });
  }

  // Build accessory status chart data
  const accStatusCounts = new Map<string, number>();
  accessoryStatusDistribution.forEach((entry) => {
    const key = entry.statustypeid ?? "__unassigned";
    accStatusCounts.set(key, entry.count);
  });

  const accChartData: Array<{ name: string; value: number }> = [];
  statuses.forEach((status) => {
    const count = accStatusCounts.get(status.statustypeid) ?? 0;
    accChartData.push({
      name: status.statustypename ?? "Unknown",
      value: count,
    });
  });

  // Time-based greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = ctx?.userId
    ? (await import("@/lib/prisma")).default.user
        .findUnique({
          where: { userid: ctx.userId },
          select: { firstname: true },
        })
        .then((u) => u?.firstname)
        .catch(() => null)
    : null;
  const firstName = await userName;

  return (
    <main>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        {greeting}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Overview of your asset management system
      </p>
      <DismissibleHelpTip id="dashboard-welcome">
        Welcome to your dashboard! Here you can see a quick overview of your
        assets, accessories, and users. Use the sidebar to navigate to specific
        sections, or click the stat cards below to jump to detailed views.
      </DismissibleHelpTip>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-2">
        <AssetStatusChart data={chartData} title="Asset Status" />
        <AssetStatusChart data={accChartData} title="Accessory Status" />
      </div>
      <div className="mt-4 sm:mt-6">
        <Suspense
          fallback={
            <div className="text-muted-foreground flex h-[420px] items-center justify-center rounded-lg border text-sm">
              Loading map...
            </div>
          }
        >
          <AssetMapClient
            locations={mapLocations}
            totalAssets={assetCount}
            totalLocations={mapLocations.length}
          />
        </Suspense>
      </div>
      <div className="mt-6 sm:mt-8 md:mt-10">
        <DashboardGrid
          serverStats={{
            assets: assetCount,
            accessories: accessoryCount,
            users: userCount,
          }}
        />
      </div>
    </main>
  );
}
