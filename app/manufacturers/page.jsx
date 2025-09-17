import React from "react";
import ManufacturersTable from "../ui/manufacturers/ManufacturersTable";
import { getManufacturers } from "@/app/lib/data";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";

export const metadata = {
  title: "Asset Tracker - Manufacturers",
  description: "Asset management tool",
};

export default async function Page() {
  const manufacturers = await getManufacturers();
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Manufacturers</h1>
        <Button asChild>
          <Link href="/manufacturers/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Manufacturer
          </Link>
        </Button>
      </div>
      <ManufacturersTable items={manufacturers} />
    </div>
  );
}
