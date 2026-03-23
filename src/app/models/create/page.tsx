import React from "react";
import ModelCreateForm from "./ui/ModelCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Model",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Models", href: "/models" },
          { label: "Create Model" },
        ]}
      />
      <ModelCreateForm />
    </>
  );
}
