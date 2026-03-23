import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
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
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licence Categories", href: "/licenceCategories" },
        ]}
      />
      <LicenceCategoriesTable items={categories} />
    </div>
  );
}
