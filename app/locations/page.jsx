import React from "react";
import LocationsTable from "../ui/locations/LocationsTable";
import { getLocation } from "@/app/lib/data";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";

export const metadata = {
  title: "Asset Tracker - Locations",
  description: "Asset management tool",
};

export default async function Page() {
  const locations = await getLocation();
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Locations</h1>
        <Button asChild>
          <Link href="/locations/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Location
          </Link>
        </Button>
      </div>
      <LocationsTable items={locations} />
    </div>
  );
}
