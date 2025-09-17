import React from "react";
import SuppliersTable from "../ui/suppliers/SuppliersTable";
import { getSuppliers } from "@/app/lib/data";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "../ui/Icons";

export const metadata = {
  title: "Asset Tracker - Suppliers",
  description: "Asset management tool",
};

export default async function Page() {
  const suppliers = await getSuppliers();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Suppliers</h1>
        <Button asChild>
          <Link href="/suppliers/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Supplier
          </Link>
        </Button>
      </div>
      <SuppliersTable items={suppliers} />
    </div>
  );
}
