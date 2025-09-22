import Link from "next/link";
import dynamic from "next/dynamic";
import { getAssets, getUsers, getAccessories } from "@/app/lib/data";
import StatCard from "./components/StatCard";

export default async function Home() {
  const user = await getUsers();
  const assets = await getAssets();
  const accessories = await getAccessories();

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
      <br />
      <div className="flex flex-row gap-8">
        <section className="w-2/3 h-72 rounded-lg border border-default-200">
          <div className="px-4 py-3 border-b border-default-200 font-medium">Latest Activity</div>
          <div className="p-4 text-5xl text-primary"></div>
        </section>
        <section className="w-1/3 h-72 rounded-lg border border-default-200">
          <div className="px-4 py-3 border-b border-default-200 font-medium">Statistics</div>
          <div className="p-4 text-5xl text-primary"></div>
        </section>
      </div>
    </main>
  );
}
