import React from "react";
import LicenceCategoriesCreateForm from "./ui/LicenceCategoriesCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Licence Category",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Licence Categories", href: "/licenceCategories" },
          { label: "Create" },
        ]}
      />
      <LicenceCategoriesCreateForm />
    </>
  );
}
