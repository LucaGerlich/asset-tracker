import React from "react";
import LocationsTable from "../ui/locations/LocationsTable";
import { getLocation } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Locations",
  description: "Asset management tool",
};

export default async function Page() {
  const locations = await getLocation();
  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Locations</h1>
      <LocationsTable items={locations} />
    </div>
  );
}
