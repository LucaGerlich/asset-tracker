import React from "react";
import ConsumableCreateForm from "../../create/ui/ConsumableCreateForm";
import {
  getConsumableById,
  getConsumableCategories,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Consumable",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [consumableRaw, categories, manufacturers, suppliers] =
    await Promise.all([
      getConsumableById(id),
      getConsumableCategories(),
      getManufacturers(),
      getSuppliers(),
    ]);

  const consumable = {
    ...consumableRaw,
    purchaseprice:
      consumableRaw.purchaseprice !== null &&
      consumableRaw.purchaseprice !== undefined
        ? Number(consumableRaw.purchaseprice)
        : null,
    purchasedate: consumableRaw.purchasedate
      ? typeof consumableRaw.purchasedate === "string"
        ? consumableRaw.purchasedate
        : consumableRaw.purchasedate.toISOString()
      : null,
    creation_date: consumableRaw.creation_date
      ? typeof consumableRaw.creation_date === "string"
        ? consumableRaw.creation_date
        : consumableRaw.creation_date.toISOString()
      : null,
    change_date: consumableRaw.change_date
      ? typeof consumableRaw.change_date === "string"
        ? consumableRaw.change_date
        : consumableRaw.change_date.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Consumables", href: "/consumables" },
          { label: "Edit" },
        ]}
      />
      <ConsumableCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        initialData={consumable}
        mode="edit"
      />
    </>
  );
}
