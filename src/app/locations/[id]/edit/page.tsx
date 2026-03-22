import React from "react";
import LocationCreateForm from "../../create/ui/LocationCreateForm";
import { getLocationById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Location",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const locationRaw = await getLocationById(id);
  const location = {
    ...locationRaw,
    creation_date: locationRaw.creation_date
      ? typeof locationRaw.creation_date === "string"
        ? locationRaw.creation_date
        : locationRaw.creation_date.toISOString()
      : null,
    change_date: locationRaw.change_date
      ? typeof locationRaw.change_date === "string"
        ? locationRaw.change_date
        : locationRaw.change_date.toISOString()
      : null,
  };

  return <LocationCreateForm initialData={location} mode="edit" />;
}
