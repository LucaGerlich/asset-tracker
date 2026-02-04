import React from "react";
import ModelCreateForm from "../../create/ui/ModelCreateForm";
import { getModelById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Model",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const model = await getModelById(id);

  return <ModelCreateForm initialData={model} mode="edit" />;
}
