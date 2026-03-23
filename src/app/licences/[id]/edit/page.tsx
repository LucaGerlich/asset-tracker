import React from "react";
import LicenceCreateForm from "../../create/ui/LicenceCreateForm";
import {
  getLicenceById,
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getUsers,
} from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Licence",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [licenceRaw, categories, manufacturers, suppliers, users] =
    await Promise.all([
      getLicenceById(id),
      getLicenceCategories(),
      getManufacturers(),
      getSuppliers(),
      getUsers(),
    ]);

  const licence = {
    ...licenceRaw,
    purchaseprice:
      licenceRaw.purchaseprice !== null &&
      licenceRaw.purchaseprice !== undefined
        ? Number(licenceRaw.purchaseprice)
        : null,
    purchasedate: licenceRaw.purchasedate
      ? typeof licenceRaw.purchasedate === "string"
        ? licenceRaw.purchasedate
        : licenceRaw.purchasedate.toISOString()
      : null,
    expirationdate: licenceRaw.expirationdate
      ? typeof licenceRaw.expirationdate === "string"
        ? licenceRaw.expirationdate
        : licenceRaw.expirationdate.toISOString()
      : null,
    creation_date: licenceRaw.creation_date
      ? typeof licenceRaw.creation_date === "string"
        ? licenceRaw.creation_date
        : licenceRaw.creation_date.toISOString()
      : null,
    change_date: licenceRaw.change_date
      ? typeof licenceRaw.change_date === "string"
        ? licenceRaw.change_date
        : licenceRaw.change_date.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licences", href: "/licences" },
          { label: "Edit" },
        ]}
      />
      <LicenceCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        users={users}
        initialData={licence}
        mode="edit"
      />
    </>
  );
}
