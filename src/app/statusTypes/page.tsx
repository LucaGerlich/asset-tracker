import React from "react";
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
      <StatusTypesTable items={statusTypes} />
    </div>
  );
}
