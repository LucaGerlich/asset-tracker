import React from "react";
import ManufacturerCreateForm from "./ui/ManufacturerCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Manufacturer",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Manufacturers", href: "/manufacturers" },
          { label: "Create Manufacturer" },
        ]}
      />
      <ManufacturerCreateForm />
    </>
  );
}
