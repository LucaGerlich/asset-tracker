import React from "react";
import AccessoryCategoriesCreateForm from "../../create/ui/AccessoryCategoriesCreateForm";
import { getAccessoryCategoryById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Accessory Category",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getAccessoryCategoryById(id);

  return <AccessoryCategoriesCreateForm initialData={category} mode="edit" />;
}
