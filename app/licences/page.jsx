import React from "react";
import LicencesTable from "../ui/licences/LicencesTable";
import { getLicences, getLicenceCategories, getManufacturers, getSuppliers } from "@/app/lib/data";

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
      <h1 className="text-2xl font-semibold mb-4">Licences</h1>
      <LicencesTable
        items={licences}
        catById={catById}
        manuById={manuById}
        supplierById={supplierById}
      />
    </div>
  );
}
