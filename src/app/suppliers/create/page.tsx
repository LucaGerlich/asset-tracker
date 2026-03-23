import React from "react";
import SupplierCreateForm from "./ui/SupplierCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Supplier",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Suppliers", href: "/suppliers" },
          { label: "Create Supplier" },
        ]}
      />
      <SupplierCreateForm />
    </>
  );
}
