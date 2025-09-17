import React from "react";
import LicencesTable from "../ui/licences/LicencesTable";
import { getLicences, getLicenceCategories, getManufacturers, getSuppliers } from "@/app/lib/data";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";

export const metadata = {
  title: "Asset Tracker - Licences",
  description: "Asset management tool",
};

export default async function Page() {
  const [licences, categories, manufacturers, suppliers] = await Promise.all([
    getLicences(),
    getLicenceCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const catById = new Map(categories.map((c) => [c.licencecategorytypeid, c.licencecategorytypename]));
  const manuById = new Map(manufacturers.map((m) => [m.manufacturerid, m.manufacturername]));
  const supplierById = new Map(suppliers.map((s) => [s.supplierid, s.suppliername]));

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Licences</h1>
        <Button asChild>
          <Link href="/licences/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Licence
          </Link>
        </Button>
      </div>
      <LicencesTable
        items={licences}
        catById={catById}
        manuById={manuById}
        supplierById={supplierById}
      />
    </div>
  );
}
