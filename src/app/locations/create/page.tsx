import React from "react";
import LocationCreateForm from "./ui/LocationCreateForm";
import { getLocation } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Location",
};

export default async function Page() {
  const locations = (await getLocation()) as {
    locationid: string;
    locationname: string | null;
  }[];
  const locationOptions = locations.map((loc) => ({
    locationid: loc.locationid,
    locationname: loc.locationname,
  }));

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Locations", href: "/locations" },
          { label: "Create Location" },
        ]}
      />
      <LocationCreateForm locations={locationOptions} />
    </>
  );
}
