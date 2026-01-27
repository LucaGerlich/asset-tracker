import React from "react";
import SupplierCreateForm from "../../create/ui/SupplierCreateForm";
import { getSupplierById } from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - Edit Supplier",
};

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supplierRaw = await getSupplierById(id);
  const supplier = {
    ...supplierRaw,
    creation_date: supplierRaw.creation_date ? supplierRaw.creation_date.toISOString() : null,
    change_date: supplierRaw.change_date ? supplierRaw.change_date.toISOString() : null,
  };

  return <SupplierCreateForm initialData={supplier} mode="edit" />;
}
