import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
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
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Asset Categories", href: "/assetCategories" },
        ]}
      />
      <AssetCategoriesTable items={categories} />
    </div>
  );
}
