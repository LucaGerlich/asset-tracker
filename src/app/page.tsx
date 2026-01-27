import Link from "next/link";
import dynamic from "next/dynamic";
import { getAssets, getUsers, getAccessories, getStatus } from "@/lib/data";
import StatCard from "../components/StatCard";
import AssetStatusChart from "@/components/charts/AssetStatusChart";

export default async function Home() {
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
      <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold">Dashboard</h1>
      <div className="mt-4 sm:mt-6 md:mt-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 md:gap-8">
          <StatCard href="/assets" title="Total Assets" value={assets.length} />
          <StatCard href="/accessories" title="Total Accessories" value={accessories.length} />
          <StatCard href="/user" title="Total User" value={user.length} />
        </div>
      </div>
      <div className="mt-4 sm:mt-6 md:mt-8">
        <AssetStatusChart data={chartData} />
      </div>
    </main>
  );
}
