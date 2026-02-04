import React from "react";
import StatusTypeCreateForm from "../../create/ui/StatusTypeCreateForm";
import { getStatusById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Status Type",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const statusType = await getStatusById(id);

  return <StatusTypeCreateForm initialData={statusType} mode="edit" />;
}
