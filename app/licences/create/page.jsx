import React from "react";
import LicenceCreateForm from "./ui/LicenceCreateForm";
import {
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getUsers,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Create Licence",
  description: "Asset management tool",
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
