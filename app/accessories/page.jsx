import React from "react";
import AccessoriesTable from "../ui/accessories/AccessoriesTable";
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
      <h1 className="text-2xl font-semibold mb-4">Accessories</h1>
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
