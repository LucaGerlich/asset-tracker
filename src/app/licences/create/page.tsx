import React from "react";
import LicenceCreateForm from "./ui/LicenceCreateForm";
import {
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getUsers,
} from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Create Licence",
};

export default async function Page() {
  const [categories, manufacturers, suppliers, users] = await Promise.all([
    getLicenceCategories(),
    getManufacturers(),
    getSuppliers(),
    getUsers(),
  ]);

  return (
    <LicenceCreateForm
      categories={categories}
      manufacturers={manufacturers}
      suppliers={suppliers}
      users={users}
    />
  );
}

