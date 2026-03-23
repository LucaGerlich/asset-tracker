import React from "react";
import {
  getAssetById,
  getCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
} from "@/lib/data";
import AssetEditForm from "./ui/AssetEditForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Asset",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const initialRaw = await getAssetById(params.id);
  const initial = {
    ...initialRaw,
    purchaseprice:
      initialRaw.purchaseprice !== null &&
      initialRaw.purchaseprice !== undefined
        ? Number(initialRaw.purchaseprice)
        : null,
  };
  const [categories, locations, manufacturers, models, statuses, suppliers] =
    await Promise.all([
      getCategories(),
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
          { label: "Assets", href: "/assets" },
          { label: "Edit" },
        ]}
      />
      <AssetEditForm
        initial={initial}
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
