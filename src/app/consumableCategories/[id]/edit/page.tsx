import React from "react";
import ConsumableCategoriesCreateForm from "../../create/ui/ConsumableCategoriesCreateForm";
import { getConsumableCategoryById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Consumable Category",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const category = await getConsumableCategoryById(id);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Consumable Categories", href: "/consumableCategories" },
          { label: "Edit" },
        ]}
      />
      <ConsumableCategoriesCreateForm initialData={category} mode="edit" />
    </>
  );
}
