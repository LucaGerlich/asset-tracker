import React from "react";
import ManufacturersTable from "../ui/manufacturers/ManufacturersTable";
import { getManufacturers } from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Manufacturers",
  description: "Asset management tool",
};

export default async function Page() {
  const manufacturersRaw = await getManufacturers();
  const manufacturers = manufacturersRaw.map((item) => ({
    ...item,
    creation_date: item.creation_date ? item.creation_date.toISOString() : null,
    change_date: item.change_date ? item.change_date.toISOString() : null,
  }));
  return (
    <div>
      <ManufacturersTable items={manufacturers} />
    </div>
  );
}
