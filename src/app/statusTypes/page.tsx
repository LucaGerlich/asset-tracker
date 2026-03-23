import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
import StatusTypesTable from "../../ui/statusTypes/StatusTypesTable";
import { getStatus } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Status Types",
  description: "Asset management tool",
};

export default async function Page() {
  const statusTypesRaw = await getStatus();
  const statusTypes = statusTypesRaw.map((item) => ({
    ...item,
  }));
  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Status Types", href: "/statusTypes" },
        ]}
      />
      <StatusTypesTable items={statusTypes} />
    </div>
  );
}
