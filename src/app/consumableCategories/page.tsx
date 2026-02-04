import React from "react";
import ConsumableCategoriesTable from "../../ui/consumableCategories/ConsumableCategoriesTable";
import { getConsumableCategories } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Consumable Categories",
  description: "Asset management tool",
};

export default async function Page() {
  const categoriesRaw = await getConsumableCategories();
  const categories = categoriesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <ConsumableCategoriesTable items={categories} />
    </div>
  );
}
