import React from "react";
import LicencesTable from "../ui/licences/LicencesTable";
import { getLicences, getLicenceCategories, getManufacturers, getSuppliers } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Licences",
  description: "Asset management tool",
};

export default async function Page() {
  const [licencesRaw, categories, manufacturers, suppliers] = await Promise.all([
    getLicences(),
    getLicenceCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const licences = licencesRaw.map((item) => ({
    ...item,
    purchaseprice:
      item.purchaseprice !== null && item.purchaseprice !== undefined
        ? Number(item.purchaseprice)
        : null,
    purchasedate: item.purchasedate ? item.purchasedate.toISOString() : null,
    expirationdate: item.expirationdate ? item.expirationdate.toISOString() : null,
    creation_date: item.creation_date ? item.creation_date.toISOString() : null,
    change_date: item.change_date ? item.change_date.toISOString() : null,
  }));

  return (
    <div>
      <LicencesTable
        items={licences}
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
      />
    </div>
  );
}
