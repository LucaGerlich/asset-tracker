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
      <h1 className="text-3xl">Dashboard</h1>
      <br />
      <div className="flex flex-row gap-8">
        <StatCard href="/assets" title="Total Assets" value={assets.length} />
        <StatCard href="/accessories" title="Total Accessories" value={accessories.length} />
        <StatCard href="/user" title="Total User" value={user.length} />
      </div>
      <br />
      <AssetStatusChart data={chartData} />
    </main>
  );
}
