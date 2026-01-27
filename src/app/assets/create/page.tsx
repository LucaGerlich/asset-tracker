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

export default async function Page() {
  const [categories, locations, manufacturers, models, statuses, suppliers, users] = await Promise.all([
    getCategories(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getSuppliers(),
    getUsers(),
  ]);

  return (
    <AssetCreateForm
      categories={categories}
      locations={locations}
      manufacturers={manufacturers}
      models={models}
      statuses={statuses}
      suppliers={suppliers}
      users={users}
    />
  );
}
