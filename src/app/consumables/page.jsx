import React from "react";
import ConsumablesTable from "../../ui/consumables/ConsumablesTable";
import { getConsumables, getConsumableCategories, getManufacturers, getSuppliers } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Consumables",
  description: "Asset management tool",
};

export default async function Page() {
  const [itemsRaw, categories, manufacturers, suppliers] = await Promise.all([
    getConsumables(),
    getConsumableCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const items = itemsRaw.map((item) => ({
    ...item,
    purchaseprice:
      item.purchaseprice !== null && item.purchaseprice !== undefined
        ? Number(item.purchaseprice)
        : null,
    purchasedate: item.purchasedate ? item.purchasedate.toISOString() : null,
    creation_date: item.creation_date ? item.creation_date.toISOString() : null,
    change_date: item.change_date ? item.change_date.toISOString() : null,
  }));

  return (
    <div>
      <ConsumablesTable
        items={items}
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
      />
    </div>
  );
}
