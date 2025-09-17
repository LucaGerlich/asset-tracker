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

export default async function Page(props) {
  const params = await props.params;
  const initialRaw = await getAssetById(params.id);
  const initial = {
    ...initialRaw,
    purchaseprice:
      initialRaw.purchaseprice !== null && initialRaw.purchaseprice !== undefined
        ? Number(initialRaw.purchaseprice)
        : null,
  };
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
