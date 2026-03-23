import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
import AssetsTableClient from "./ui/AssetsTableClient";
import {
  getAssets,
  getLocation,
  getUsers,
  getStatus,
  getManufacturers,
  getModel,
  getCategories,
  getUserAssets,
} from "@/lib/data";

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
    { value: "all", label: "All" },
  ];

  const [
    databaseAssetsRaw,
    location,
    user,
    status,
    manufacturer,
    model,
    categories,
    userAssets,
  ] = await Promise.all([
    getAssets(),
    getLocation(),
    getUsers(),
    getStatus(),
    getManufacturers(),
    getModel(),
    getCategories(),
    getUserAssets(),
  ]);

  // Sanitize Prisma Decimals (purchaseprice) for client component props
  const databaseAssets = databaseAssetsRaw.map((a) => ({
    ...a,
    purchaseprice:
      a.purchaseprice !== null && a.purchaseprice !== undefined
        ? Number(a.purchaseprice)
        : null,
  }));

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Assets", href: "/assets" },
        ]}
      />
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
