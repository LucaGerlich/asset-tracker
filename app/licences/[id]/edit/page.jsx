import React from "react";
import LicenceCreateForm from "../../create/ui/LicenceCreateForm";
import {
  getLicenceById,
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getUsers,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Licence",
};

export default async function Page({ params }) {
  const { id } = params;

  const [licenceRaw, categories, manufacturers, suppliers, users] = await Promise.all([
    getLicenceById(id),
    getLicenceCategories(),
    getManufacturers(),
    getSuppliers(),
    getUsers(),
  ]);

  const licence = {
    ...licenceRaw,
    purchaseprice:
      licenceRaw.purchaseprice !== null && licenceRaw.purchaseprice !== undefined
        ? Number(licenceRaw.purchaseprice)
        : null,
    purchasedate: licenceRaw.purchasedate ? licenceRaw.purchasedate.toISOString() : null,
    expirationdate: licenceRaw.expirationdate ? licenceRaw.expirationdate.toISOString() : null,
    creation_date: licenceRaw.creation_date ? licenceRaw.creation_date.toISOString() : null,
    change_date: licenceRaw.change_date ? licenceRaw.change_date.toISOString() : null,
  };

  return (
    <LicenceCreateForm
      categories={categories}
      manufacturers={manufacturers}
      suppliers={suppliers}
      users={users}
      initialData={licence}
      mode="edit"
    />
  );
}
