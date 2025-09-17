import React from "react";
import AssetsTableClient from "./ui/AssetsTableClient";
import Link from "next/link";
import { PlusIcon } from "../ui/Icons";
import { Button } from "@/components/ui/button";
import {
  getAssets,
  getLocation,
  getUsers,
  getStatus,
  getManufacturers,
  getModel,
  getCategories,
  getUserAssets,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - Assets",
  description: "Asset management tool",
};

export default async function Page() {
  const columns = [
    { name: "ID", uid: "assetid" },
    { name: "NAME", uid: "assetname", sortable: true },
    { name: "TAG", uid: "assettag", sortable: true },
    { name: "SERIAL", uid: "serialnumber" },
    { name: "BELONGS TO", uid: "belongsto", sortable: true },
    { name: "MANUFACTUERER", uid: "manufacturerid", sortable: true },
    { name: "MODEL", uid: "modelid", sortable: true },
    { name: "SPECS", uid: "specs" },
    { name: "NOTES", uid: "notes" },
    { name: "STATUS", uid: "statustypeid", sortable: true },
    { name: "CATEGORY", uid: "assetcategorytypeid", sortable: true },
    { name: "REQESTABLE", uid: "requestable", sortable: true },
    { name: "MOBILE", uid: "mobile", sortable: true },
    { name: "LOCATION", uid: "locationid", sortable: true },
    { name: "PRICE", uid: "purchaseprice" },
    { name: "ACTIONS", uid: "actions" },
  ];

  const selectOptions = [
    { value: "20", label: "20" }, //startvalue
    { value: "25", label: "25" },
    { value: "50", label: "50" },
    { value: "75", label: "75" },
    { value: "100", label: "100" },
  ];

  const databaseAssetsRaw = await getAssets();
  // Sanitize Prisma Decimals (purchaseprice) for client component props
  const databaseAssets = databaseAssetsRaw.map((a) => ({
    ...a,
    purchaseprice: a.purchaseprice !== null && a.purchaseprice !== undefined ? Number(a.purchaseprice) : null,
  }));
  const location = await getLocation();
  const user = await getUsers();
  const status = await getStatus();
  const manufacturer = await getManufacturers();
  const model = await getModel();
  const categories = await getCategories();
  const userAssets = await getUserAssets();

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-semibold">Assets</h1>
        <Button asChild>
          <Link href="/assets/create" className="inline-flex items-center gap-2">
            <PlusIcon className="h-4 w-4" />
            Create Asset
          </Link>
        </Button>
      </div>
      <AssetsTableClient
        data={databaseAssets}
        locations={location}
        user={user}
        status={status}
        manufacturers={manufacturer}
        models={model}
        categories={categories}
        columns={columns}
        selectOptions={selectOptions}
        userAssets={userAssets}
      ></AssetsTableClient>
    </div>
  );
}
