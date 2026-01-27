import React from "react";
import SuppliersTable from "../../ui/suppliers/SuppliersTable";
import { getSuppliers } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Suppliers",
  description: "Asset management tool",
};

export default async function Page() {
  const suppliersRaw = await getSuppliers();
  const suppliers = suppliersRaw.map((item) => ({
    ...item,
    creation_date: item.creation_date ? item.creation_date.toISOString() : null,
    change_date: item.change_date ? item.change_date.toISOString() : null,
  }));

  return (
    <div>
      <SuppliersTable items={suppliers} />
    </div>
  );
}
