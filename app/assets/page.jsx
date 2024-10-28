import React from "react";
import DashboardTable from "../ui/assets/DashboardTable";
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

  const databaseAssets = await getAssets();
  const location = await getLocation();
  const user = await getUsers();
  const status = await getStatus();
  const manufacturer = await getManufacturers();
  const model = await getModel();
  const categories = await getCategories();
  const userAssets = await getUserAssets();

  return (
    <div>
      <DashboardTable
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
      ></DashboardTable>
    </div>
  );
}
