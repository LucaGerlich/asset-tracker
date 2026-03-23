import React, { Suspense } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import AccessoriesTable from "../../ui/accessories/AccessoriesTable";
import {
  getAccessories,
  getManufacturers,
  getModel,
  getStatus,
  getLocation,
  getSuppliers,
  getAccessoryCategories,
} from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Accessories",
  description: "Asset management tool",
};

export default async function Page() {
  const [
    accessoriesRaw,
    manufacturers,
    models,
    statuses,
    locations,
    suppliers,
    categories,
  ] = await Promise.all([
    getAccessories(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getLocation(),
    getSuppliers(),
    getAccessoryCategories(),
  ]);

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessories", href: "/accessories" },
        ]}
      />
      <Suspense fallback={null}>
        <AccessoriesTable
          items={accessoriesRaw.map((item) => ({
            ...item,
            purchaseprice:
              item.purchaseprice !== null && item.purchaseprice !== undefined
                ? Number(item.purchaseprice)
                : null,
            purchasedate: item.purchasedate
              ? typeof item.purchasedate === "string"
                ? item.purchasedate
                : item.purchasedate.toISOString()
              : null,
            creation_date: item.creation_date
              ? typeof item.creation_date === "string"
                ? item.creation_date
                : item.creation_date.toISOString()
              : null,
            change_date: item.change_date
              ? typeof item.change_date === "string"
                ? item.change_date
                : item.change_date.toISOString()
              : null,
          }))}
          manufacturers={manufacturers}
          models={models}
          statuses={statuses}
          categories={categories}
          locations={locations}
          suppliers={suppliers}
        />
      </Suspense>
    </div>
  );
}
