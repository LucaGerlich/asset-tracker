import React from "react";
import Breadcrumb from "../../components/Breadcrumb";
import Tabs from "../../components/Tabs";
import { Divider } from "@nextui-org/divider";
import {
  getAssetById,
  getLocationById,
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

export default async function Page({ params }) {
  const Asset = await getAssetById(params.id);
  const location = await getLocationById(Asset?.locationid);
  const user = await getUsers();
  const status = await getStatus();
  const manufacturer = await getManufacturers();
  const model = await getModel();
  const categories = await getCategories();
  const userAssets = await getUserAssets();
  console.log("Params:", params.id);
  console.log("Asset:", Asset);
  console.log("Location:", location);

  const BreadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Assets", href: "/assets" },
    { label: Asset.assetname, href: `/assets/${Asset.assetid}` },
  ];

  return (
    <>
      <Breadcrumb options={BreadcrumbOptions}></Breadcrumb>
      <div className="flex flex-col w-full h-full overflow-hidden">
        <h1 className="text-2xl">Asset Details for: {Asset.assetname}</h1>
        <Divider></Divider>
        <br />
        {/* <div className="w-1/3 h-full bg-red-600"></div>
        <div className="w-2/3 h-full bg-green-600"></div> */}

        <div className="flex flex-col justify-between max-w-72">
          <h1 className="text-xl">Information:</h1>
          <span>{Asset.assetname}</span>
          <span>{Asset.assetid}</span>
          <span>{Asset.assettag}</span>
          <span>{Asset.serialnumber}</span>
          <span>{Asset.modelid}</span>
          <span>{Asset.specs}</span>
          <span>{Asset.notes}</span>
          <span>{Asset.purchaseprice}</span>
          <span>{Asset.mobile}</span>
          <span>{Asset.requestable}</span>
        </div>
        <br />
        <h1 className="text-2xl">Asset History</h1>
        <Divider></Divider>
        <br />
      </div>
    </>
  );
}
