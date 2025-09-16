import React from "react";
import ConsumablesTable from "../ui/consumables/ConsumablesTable";
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
      <h1 className="text-2xl font-semibold mb-4">Consumables</h1>
      <ConsumablesTable
        items={items}
        catById={catById}
        manuById={manuById}
        supplierById={supplierById}
      />
    </div>
  );
}
