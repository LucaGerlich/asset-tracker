import React, { Suspense } from "react";
import Link from "next/link";
import { getComponents, getComponentCategories, getManufacturers, getSuppliers } from "@/lib/data";
import ComponentsTable from "./ui/ComponentsTable";

export const metadata = {
  title: "Asset Tracker - Components",
  description: "Manage trackable parts and hardware components",
};

export default async function Page() {
  const [componentsRaw, categories, manufacturers, suppliers] = await Promise.all([
    getComponents(),
    getComponentCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const items = componentsRaw.map((item) => ({
    ...item,
    purchasePrice:
      item.purchasePrice !== null && item.purchasePrice !== undefined
        ? Number(item.purchasePrice)
        : null,
    purchaseDate: item.purchaseDate ? item.purchaseDate.toISOString() : null,
    createdAt: item.createdAt ? item.createdAt.toISOString() : null,
    updatedAt: item.updatedAt ? item.updatedAt.toISOString() : null,
  }));

  return (
    <div>
      <Suspense fallback={null}>
        <ComponentsTable
          items={items}
          categories={categories}
          manufacturers={manufacturers}
          suppliers={suppliers}
        />
      </Suspense>
    </div>
  );
}
