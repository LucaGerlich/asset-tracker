import React from "react";
import SuppliersTable from "../ui/suppliers/SuppliersTable";
import { getSuppliers } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Suppliers",
  description: "Asset management tool",
};

export default async function Page() {
  const suppliers = await getSuppliers();

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Suppliers</h1>
      <SuppliersTable items={suppliers} />
    </div>
  );
}
