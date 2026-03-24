import {
  getAssetCount,
  getUserCount,
  getAccessoryCount,
  getAssetStatusDistribution,
  getStatus,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";
import StatCard from "../../components/StatCard";
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

  const [userCount, assetCount, accessoryCount, statusDistribution, statuses] =
    await Promise.all([
      getUserCount(),
      getAssetCount(),
      getAccessoryCount(),
      getAssetStatusDistribution(),
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
      },
    });
    mapLocations = locationsWithCoords.map((loc) => ({
      id: loc.locationid,
      name: loc.locationname,
      latitude: loc.latitude!,
      longitude: loc.longitude!,
      assetCount: loc._count.asset,
    }));
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

  return (
    <main>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Dashboard", href: "/dashboard" },
        ]}
      />
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Dashboard
      </h1>
      <p className="text-muted-foreground mt-1 text-sm">
        Overview of your asset management system
      </p>
      <DismissibleHelpTip id="dashboard-welcome">
        Welcome to your dashboard! Here you can see a quick overview of your
        assets, accessories, and users. Use the sidebar to navigate to specific
        sections, or click the stat cards below to jump to detailed views.
      </DismissibleHelpTip>
      <div className="mt-6 sm:mt-8 md:mt-10">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            href="/assets"
            title="Total Assets"
            value={assetCount}
            icon="Boxes"
          />
          <StatCard
            href="/accessories"
            title="Total Accessories"
            value={accessoryCount}
            icon="Puzzle"
          />
          <StatCard
            href="/user"
            title="Total Users"
            value={userCount}
            icon="Users"
          />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        <AssetStatusChart data={chartData} />
        <Suspense
          fallback={
            <div className="text-muted-foreground flex h-[300px] items-center justify-center rounded-lg border text-sm">
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
