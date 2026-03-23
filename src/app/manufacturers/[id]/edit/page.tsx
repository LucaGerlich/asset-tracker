import React from "react";
import ManufacturerCreateForm from "../../create/ui/ManufacturerCreateForm";
import { getManufacturerById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Manufacturer",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const manufacturerRaw = await getManufacturerById(id);
  const manufacturer = {
    ...manufacturerRaw,
    creation_date: manufacturerRaw.creation_date
      ? typeof manufacturerRaw.creation_date === "string"
        ? manufacturerRaw.creation_date
        : manufacturerRaw.creation_date.toISOString()
      : null,
    change_date: manufacturerRaw.change_date
      ? typeof manufacturerRaw.change_date === "string"
        ? manufacturerRaw.change_date
        : manufacturerRaw.change_date.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Manufacturers", href: "/manufacturers" },
          { label: "Edit" },
        ]}
      />
      <ManufacturerCreateForm initialData={manufacturer} mode="edit" />
    </>
  );
}
