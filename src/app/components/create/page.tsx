import React from "react";
import ComponentCreateForm from "./ui/ComponentCreateForm";
import {
  getComponentCategories,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";
import prisma from "@/lib/prisma";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Component",
};

export default async function Page() {
  const [categories, manufacturers, suppliers, locations] = await Promise.all([
    getComponentCategories(),
    getManufacturers(),
    getSuppliers(),
    prisma.location.findMany({ orderBy: { locationname: "asc" } }),
  ]);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Components", href: "/components" },
          { label: "Create Component" },
        ]}
      />
      <ComponentCreateForm
        categories={categories}
        manufacturers={manufacturers}
        suppliers={suppliers}
        locations={locations}
      />
    </>
  );
}
