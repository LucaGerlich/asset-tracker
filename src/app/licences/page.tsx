import React, { Suspense } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import LicencesTable from "../../ui/licences/LicencesTable";
import {
  getLicences,
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Licences",
  description: "Asset management tool",
};

export default async function Page() {
  const [licencesRaw, categories, manufacturers, suppliers] = await Promise.all(
    [getLicences(), getLicenceCategories(), getManufacturers(), getSuppliers()],
  );

  const licences = licencesRaw.map((item) => ({
    ...item,
    purchaseprice:
      item.purchaseprice !== null && item.purchaseprice !== undefined
        ? Number(item.purchaseprice)
        : null,
    purchasedate: item.purchasedate
      ? typeof item.purchasedate === "string"
        ? item.purchasedate
        : item.purchasedate.toISOString()
      : null,
    expirationdate: item.expirationdate
      ? typeof item.expirationdate === "string"
        ? item.expirationdate
        : item.expirationdate.toISOString()
      : null,
    creation_date: item.creation_date
      ? typeof item.creation_date === "string"
        ? item.creation_date
        : item.creation_date.toISOString()
      : null,
    change_date: item.change_date
      ? typeof item.change_date === "string"
        ? item.change_date
        : item.change_date.toISOString()
      : null,
  }));

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licences", href: "/licences" },
        ]}
      />
      <Suspense fallback={null}>
        <LicencesTable
          items={licences}
          categories={categories}
          manufacturers={manufacturers}
          suppliers={suppliers}
        />
      </Suspense>
    </div>
  );
}
