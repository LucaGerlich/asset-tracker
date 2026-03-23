import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
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
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessory Categories", href: "/accessoryCategories" },
        ]}
      />
      <AccessoryCategoriesTable items={categories} />
    </div>
  );
}
