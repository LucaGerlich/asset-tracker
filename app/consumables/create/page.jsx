import React from "react";
import ConsumableCreateForm from "./ui/ConsumableCreateForm";
import { getConsumableCategories, getManufacturers, getSuppliers } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Create Consumable",
  description: "Asset management tool",
};

export default async function Page() {
  const [categories, manufacturers, suppliers] = await Promise.all([
    getConsumableCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  return (
    <ConsumableCreateForm
      categories={categories}
      manufacturers={manufacturers}
      suppliers={suppliers}
    />
  );
}
