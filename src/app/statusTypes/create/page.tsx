import React from "react";
import StatusTypeCreateForm from "./ui/StatusTypeCreateForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Status Type",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Status Types", href: "/statusTypes" },
          { label: "Create Status Type" },
        ]}
      />
      <StatusTypeCreateForm />
    </>
  );
}
