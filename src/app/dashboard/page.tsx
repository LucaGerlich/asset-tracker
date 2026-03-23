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

export const metadata = {
  title: "Asset Tracker - Dashboard",
};

export default async function DashboardPage() {
  const ctx = await getOrganizationContext();
  const isAdmin = ctx?.isAdmin ?? false;

  if (!isAdmin) {
    return <UserDashboard userId={ctx?.userId} />;
  }

  const [userCount, assetCount, accessoryCount, statusDistribution, statuses] =
    await Promise.all([
      getUserCount(),
      getAssetCount(),
      getAccessoryCount(),
      getAssetStatusDistribution(),
      getStatus(),
    ]);

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
      <div className="mt-6 sm:mt-8 md:mt-10">
        <AssetStatusChart data={chartData} />
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
