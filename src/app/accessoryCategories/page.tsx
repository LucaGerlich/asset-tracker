import React from "react";
import AccessoryCategoriesTable from "../../ui/accessoryCategories/AccessoryCategoriesTable";
import { getAccessoryCategories } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Accessory Categories",
  description: "Asset management tool",
};

export default async function Page() {
  const categoriesRaw = await getAccessoryCategories();
  const categories = categoriesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <AccessoryCategoriesTable items={categories} />
    </div>
  );
}
