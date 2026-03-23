import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
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
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Locations", href: "/locations" },
        ]}
      />
      <LocationsTable items={locations} />
    </div>
  );
}
