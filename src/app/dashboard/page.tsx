import { getAssets, getUsers, getAccessories, getStatus } from "@/lib/data";
import StatCard from "../../components/StatCard";
import AssetStatusChart from "@/components/charts/AssetStatusChart";
import DismissibleHelpTip from "@/components/DismissibleHelpTip";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export const metadata = {
  title: "Dashboard | Asset Tracker",
};

export default async function DashboardPage() {
  const [user, assets, accessories, statuses] = await Promise.all([
    getUsers(),
    getAssets(),
    getAccessories(),
    getStatus(),
  ]);

  const statusCounts = new Map();

  assets.forEach((asset) => {
    const key = asset.statustypeid ?? "__unassigned";
    statusCounts.set(key, (statusCounts.get(key) ?? 0) + 1);
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
      <h1 className="text-lg font-semibold sm:text-xl md:text-2xl lg:text-3xl">
        Dashboard
      </h1>
      <DismissibleHelpTip id="dashboard-welcome">
        Welcome to your dashboard! Here you can see a quick overview of your
        assets, accessories, and users. Use the sidebar to navigate to specific
        sections, or click the stat cards below to jump to detailed views.
      </DismissibleHelpTip>
      <div className="mt-4 sm:mt-6 md:mt-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 md:gap-8 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard href="/assets" title="Total Assets" value={assets.length} />
          <StatCard
            href="/accessories"
            title="Total Accessories"
            value={accessories.length}
          />
          <StatCard href="/user" title="Total User" value={user.length} />
        </div>
      </div>
      <div className="mt-4 sm:mt-6 md:mt-8">
        <AssetStatusChart data={chartData} />
      </div>
      <div className="mt-4 sm:mt-6 md:mt-8">
        <DashboardGrid />
      </div>
    </main>
  );
}
