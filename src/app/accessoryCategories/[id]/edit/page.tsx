import React from "react";
import AccessoryCategoriesCreateForm from "../../create/ui/AccessoryCategoriesCreateForm";
import { getAccessoryCategoryById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Accessory Category",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getAccessoryCategoryById(id);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessory Categories", href: "/accessoryCategories" },
          { label: "Edit" },
        ]}
      />
      <AccessoryCategoriesCreateForm initialData={category} mode="edit" />
    </>
  );
}
