import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { getKits } from "@/lib/data";
import { Button } from "@/components/ui/button";
import KitsTable from "./ui/KitsTable";

export const metadata = {
  title: "Asset Tracker - Kits",
  description: "Asset management tool",
};

export default async function KitsPage() {
  const kits = await getKits();

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Kits", href: "/kits" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Predefined Kits</h1>
        <Button asChild>
          <Link href="/kits/create">Create Kit</Link>
        </Button>
      </div>
      <KitsTable kits={kits} />
    </div>
  );
}
