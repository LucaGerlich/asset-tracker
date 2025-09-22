import React from "react";
import ManufacturerCreateForm from "../../create/ui/ManufacturerCreateForm";
import { getManufacturerById } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Manufacturer",
};

export default async function Page({ params }) {
  const { id } = params;
  const manufacturerRaw = await getManufacturerById(id);
  const manufacturer = {
    ...manufacturerRaw,
    creation_date: manufacturerRaw.creation_date
      ? manufacturerRaw.creation_date.toISOString()
      : null,
    change_date: manufacturerRaw.change_date ? manufacturerRaw.change_date.toISOString() : null,
  };

  return <ManufacturerCreateForm initialData={manufacturer} mode="edit" />;
}
