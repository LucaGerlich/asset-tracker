import React from "react";
import ConsumableCategoriesCreateForm from "../../create/ui/ConsumableCategoriesCreateForm";
import { getConsumableCategoryById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Consumable Category",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getConsumableCategoryById(id);

  return <ConsumableCategoriesCreateForm initialData={category} mode="edit" />;
}
