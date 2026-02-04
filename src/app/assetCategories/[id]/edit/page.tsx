import React from "react";
import AssetCategoryCreateForm from "../../create/ui/AssetCategoryCreateForm";
import { getAssetCategoryById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Asset Category",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getAssetCategoryById(id);

  return <AssetCategoryCreateForm initialData={category} mode="edit" />;
}
