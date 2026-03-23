import React from "react";
import ConsumableCategoriesCreateForm from "./ui/ConsumableCategoriesCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Consumable Category",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Consumable Categories", href: "/consumableCategories" },
          { label: "Create" },
        ]}
      />
      <ConsumableCategoriesCreateForm />
    </>
  );
}
