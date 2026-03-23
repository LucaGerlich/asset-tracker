import React from "react";
import AccessoryCreateForm from "./ui/AccessoryCreateForm";
import {
  getAccessoryCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Accessory",
};

export default async function Page() {
  const [categories, locations, manufacturers, models, statuses, suppliers] =
    await Promise.all([
      getAccessoryCategories(),
      getLocation(),
      getManufacturers(),
      getModel(),
      getStatus(),
      getSuppliers(),
    ]);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessories", href: "/accessories" },
          { label: "Create Accessory" },
        ]}
      />
      <AccessoryCreateForm
        categories={categories}
        locations={locations}
        manufacturers={manufacturers}
        models={models}
        statuses={statuses}
        suppliers={suppliers}
      />
    </>
  );
}
