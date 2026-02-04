import React from "react";
import AssetCategoriesTable from "../../ui/assetCategories/AssetCategoriesTable";
import { getCategories } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Asset Categories",
  description: "Asset management tool",
};

export default async function Page() {
  const categoriesRaw = await getCategories();
  const categories = categoriesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <AssetCategoriesTable items={categories} />
    </div>
  );
}
