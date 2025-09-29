import React from "react";
import LocationsTable from "../../ui/locations/LocationsTable";
import { getLocation } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Locations",
  description: "Asset management tool",
};

export default async function Page() {
  const locations = await getLocation();
  return (
    <div>
      <LocationsTable items={locations} />
    </div>
  );
}
