import React from "react";
import AccessoryCreateForm from "../../create/ui/AccessoryCreateForm";
import {
  getAccessoryById,
  getAccessoryCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Accessory",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [
    accessoryRaw,
    categories,
    locations,
    manufacturers,
    models,
    statuses,
    suppliers,
  ] = await Promise.all([
    getAccessoryById(id),
    getAccessoryCategories(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getSuppliers(),
  ]);

  const accessory = {
    ...accessoryRaw,
    purchaseprice:
      accessoryRaw.purchaseprice !== null &&
      accessoryRaw.purchaseprice !== undefined
        ? Number(accessoryRaw.purchaseprice)
        : null,
    purchasedate: accessoryRaw.purchasedate
      ? typeof accessoryRaw.purchasedate === "string"
        ? accessoryRaw.purchasedate
        : accessoryRaw.purchasedate.toISOString()
      : null,
    creation_date: accessoryRaw.creation_date
      ? typeof accessoryRaw.creation_date === "string"
        ? accessoryRaw.creation_date
        : accessoryRaw.creation_date.toISOString()
      : null,
    change_date: accessoryRaw.change_date
      ? typeof accessoryRaw.change_date === "string"
        ? accessoryRaw.change_date
        : accessoryRaw.change_date.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessories", href: "/accessories" },
          { label: "Edit" },
        ]}
      />
      <AccessoryCreateForm
        categories={categories}
        locations={locations}
        manufacturers={manufacturers}
        models={models}
        statuses={statuses}
        suppliers={suppliers}
        initialData={accessory}
        mode="edit"
      />
    </>
  );
}
