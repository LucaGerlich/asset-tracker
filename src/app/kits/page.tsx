import Link from "next/link";
import { getKits } from "@/lib/data";
import { Button } from "@/components/ui/button";
import KitsTable from "./ui/KitsTable";

export default async function KitsPage() {
  const kits = await getKits();

  return (
    <div className="space-y-6 p-6">
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
