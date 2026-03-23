import React from "react";
import AssetCategoryCreateForm from "../../create/ui/AssetCategoryCreateForm";
import { getAssetCategoryById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Asset Category",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getAssetCategoryById(id);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Asset Categories", href: "/assetCategories" },
          { label: "Edit" },
        ]}
      />
      <AssetCategoryCreateForm initialData={category} mode="edit" />
    </>
  );
}
