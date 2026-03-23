import React from "react";
import StatusTypeCreateForm from "../../create/ui/StatusTypeCreateForm";
import { getStatusById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Status Type",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const statusType = await getStatusById(id);

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Status Types", href: "/statusTypes" },
          { label: "Edit" },
        ]}
      />
      <StatusTypeCreateForm initialData={statusType} mode="edit" />
    </>
  );
}
