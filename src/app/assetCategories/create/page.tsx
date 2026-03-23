import React from "react";
import AssetCategoryCreateForm from "./ui/AssetCategoryCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Asset Category",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Asset Categories", href: "/assetCategories" },
          { label: "Create" },
        ]}
      />
      <AssetCategoryCreateForm />
    </>
  );
}
