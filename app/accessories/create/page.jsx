import React from "react";
import AccessoryCreateForm from "./ui/AccessoryCreateForm";
import {
  getAccessoryCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Create Accessory",
};

export default async function Page() {
  const [categories, locations, manufacturers, models, statuses, suppliers] = await Promise.all([
    getAccessoryCategories(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getSuppliers(),
  ]);

  return (
    <AccessoryCreateForm
      categories={categories}
      locations={locations}
      manufacturers={manufacturers}
      models={models}
      statuses={statuses}
      suppliers={suppliers}
    />
  );
}

