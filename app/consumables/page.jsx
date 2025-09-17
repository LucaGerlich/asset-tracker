import React from "react";
import ConsumablesTable from "../ui/consumables/ConsumablesTable";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";
import { getConsumables, getConsumableCategories, getManufacturers, getSuppliers } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Consumables",
  description: "Asset management tool",
};

export default async function Page() {
  const [items, categories, manufacturers, suppliers] = await Promise.all([
    getConsumables(),
    getConsumableCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const catById = new Map(categories.map((c) => [c.consumablecategorytypeid, c.consumablecategorytypename]));
  const manuById = new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername]));
  const supplierById = new Map(suppliers.map((s) => [s.supplierid, s.suppliername]));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Consumables</h1>
        <Button asChild>
          <Link href="/consumables/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Consumable
          </Link>
        </Button>
      </div>
      <ConsumablesTable
        items={items}
        catById={catById}
        manuById={manuById}
        supplierById={supplierById}
      />
    </div>
  );
}
