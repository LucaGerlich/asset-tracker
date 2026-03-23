import React from "react";
import LocationCreateForm from "../../create/ui/LocationCreateForm";
import { getLocationById, getLocation } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Location",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [locationRaw, allLocationsRaw] = await Promise.all([
    getLocationById(id),
    getLocation(),
  ]);
  const allLocations = allLocationsRaw as {
    locationid: string;
    locationname: string | null;
  }[];
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

  const locationOptions = allLocations.map((loc) => ({
    locationid: loc.locationid,
    locationname: loc.locationname,
  }));

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Locations", href: "/locations" },
          { label: "Edit" },
        ]}
      />
      <LocationCreateForm
        initialData={location}
        mode="edit"
        locations={locationOptions}
      />
    </>
  );
}
