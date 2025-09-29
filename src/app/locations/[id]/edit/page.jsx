import React from "react";
import LocationCreateForm from "../../create/ui/LocationCreateForm";
import { getLocationById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Location",
};

export default async function Page({ params }) {
  const { id } = params;
  const locationRaw = await getLocationById(id);
  const location = {
    ...locationRaw,
    creation_date: locationRaw.creation_date ? locationRaw.creation_date.toISOString() : null,
    change_date: locationRaw.change_date ? locationRaw.change_date.toISOString() : null,
  };

  return <LocationCreateForm initialData={location} mode="edit" />;
}
