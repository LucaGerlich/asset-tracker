import React from "react";
import AccessoriesTable from "../ui/accessories/AccessoriesTable";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";
import {
  getAccessories,
  getManufacturers,
  getModel,
  getStatus,
  getLocation,
  getSuppliers,
  getAccessoryCategories,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Accessories",
  description: "Asset management tool",
};

export default async function Page() {
  const [
    accessories,
    manufacturers,
    models,
    statuses,
    locations,
    suppliers,
    categories,
  ] = await Promise.all([
    getAccessories(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getLocation(),
    getSuppliers(),
    getAccessoryCategories(),
  ]);

  const manuById = new Map(
    manufacturers.map((m) => [m.manufacturerid, m.manufacturername])
  );
  const modelById = new Map(models.map((m) => [m.modelid, m.modelname]));
  const statusById = new Map(
    statuses.map((s) => [s.statustypeid, s.statustypename])
  );
  const locationById = new Map(
    locations.map((l) => [l.locationid, l.locationname])
  );
  const supplierById = new Map(
    suppliers.map((s) => [s.supplierid, s.suppliername])
  );
  const categoryById = new Map(
    categories.map((c) => [
      c.accessoriecategorytypeid,
      c.accessoriecategorytypename,
    ])
  );

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Accessories</h1>
        <Button asChild>
          <Link href="/accessories/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Accessory
          </Link>
        </Button>
      </div>
      <AccessoriesTable
        items={accessories}
        manuById={manuById}
        modelById={modelById}
        statusById={statusById}
        categoryById={categoryById}
        locationById={locationById}
        supplierById={supplierById}
      />
    </div>
  );
}
