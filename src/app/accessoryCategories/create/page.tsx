import React from "react";
import AccessoryCategoriesCreateForm from "./ui/AccessoryCategoriesCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Accessory Category",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessory Categories", href: "/accessoryCategories" },
          { label: "Create" },
        ]}
      />
      <AccessoryCategoriesCreateForm />
    </>
  );
}
