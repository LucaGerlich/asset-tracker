import React from "react";
import {
  getCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
  getUsers,
} from "@/lib/data";
import AssetCreateForm from "./ui/AssetCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Asset",
};

export default async function Page() {
  const [
    categories,
    locations,
    manufacturers,
    models,
    statuses,
    suppliers,
    users,
  ] = await Promise.all([
    getCategories(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getSuppliers(),
    getUsers(),
  ]);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Assets", href: "/assets" },
          { label: "Create Asset" },
        ]}
      />
      <AssetCreateForm
        categories={categories}
        locations={locations}
        manufacturers={manufacturers}
        models={models}
        statuses={statuses}
        suppliers={suppliers}
        users={users}
      />
    </>
  );
}
