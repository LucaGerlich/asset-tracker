import React from "react";
import {
  getAssetById,
  getCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
} from "@/app/lib/data";
import AssetEditForm from "./ui/AssetEditForm";

export default async function Page({ params }) {
  const initial = await getAssetById(params.id);
  const [categories, locations, manufacturers, models, statuses, suppliers] = await Promise.all([
    getCategories(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getSuppliers(),
  ]);

  return (
    <AssetEditForm
      initial={initial}
      categories={categories}
      locations={locations}
      manufacturers={manufacturers}
      models={models}
      statuses={statuses}
      suppliers={suppliers}
    />
  );
}
