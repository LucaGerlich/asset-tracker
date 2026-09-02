import { notFound } from "next/navigation";
import SupplierCreateForm from "../../create/ui/SupplierCreateForm";
import { getSupplierById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Edit Supplier",
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let supplierRaw;
  try {
    supplierRaw = await getSupplierById(id);
  } catch {
    notFound();
  }
  const supplier = {
    ...supplierRaw,
    creation_date: supplierRaw.creation_date
      ? typeof supplierRaw.creation_date === "string"
        ? supplierRaw.creation_date
        : supplierRaw.creation_date.toISOString()
      : null,
    change_date: supplierRaw.change_date
      ? typeof supplierRaw.change_date === "string"
        ? supplierRaw.change_date
        : supplierRaw.change_date.toISOString()
      : null,
  };

  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Suppliers", href: "/suppliers" },
          { label: "Edit" },
        ]}
      />
      <SupplierCreateForm initialData={supplier} mode="edit" />
    </>
  );
}
