import React from "react";
import LicenceCategoriesTable from "../../ui/licenceCategories/LicenceCategoriesTable";
import { getLicenceCategories } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Licence Categories",
  description: "Asset management tool",
};

export default async function Page() {
  const categoriesRaw = await getLicenceCategories();
  const categories = categoriesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <LicenceCategoriesTable items={categories} />
    </div>
  );
}
