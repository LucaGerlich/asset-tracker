import React from "react";
import LicenceCategoriesCreateForm from "../../create/ui/LicenceCategoriesCreateForm";
import { getLicenceCategoryById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Licence Category",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const category = await getLicenceCategoryById(id);

  return <LicenceCategoriesCreateForm initialData={category} mode="edit" />;
}
