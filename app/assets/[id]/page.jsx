import React from "react";
import Link from "next/link";
import Breadcrumb from "../../components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  getAssetById,
  getLocationById,
  getUsers,
  getStatus,
  getManufacturers,
  getModel,
  getCategories,
  getUserAssets,
  getSuppliers,
} from "@/app/lib/data";
import AssetDetailHeader from "./ui/AssetDetailHeader";

export const metadata = {
  title: "Asset Tracker - Asset Details",
  description: "Asset management tool",
};

function asCurrency(value) {
  if (value == null) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(n);
}

function booleanPill(val) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${val ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
      {val ? "Yes" : "No"}
    </span>
  );
}

export default async function Page(props) {
  const params = await props.params;
  const assetRaw = await getAssetById(params.id);
  const asset = {
    ...assetRaw,
    purchaseprice:
      assetRaw.purchaseprice !== null && assetRaw.purchaseprice !== undefined
        ? Number(assetRaw.purchaseprice)
        : null,
  };
  const location = asset?.locationid ? await getLocationById(asset.locationid) : null;
  const users = await getUsers();
  const status = await getStatus();
  const manufacturers = await getManufacturers();
  const models = await getModel();
  const categories = await getCategories();
  const suppliers = await getSuppliers();
  const userAssets = await getUserAssets();

  const userByAsset = userAssets.find((ua) => ua.assetid === asset.assetid);
  const assignedUser = userByAsset ? users.find((u) => u.userid === userByAsset.userid) : null;

  const statusName = asset.statustypeid ? status.find((s) => s.statustypeid === asset.statustypeid)?.statustypename : null;
  const manufacturerName = asset.manufacturerid ? manufacturers.find((m) => m.manufacturerid === asset.manufacturerid)?.manufacturername : null;
  const modelName = asset.modelid ? models.find((m) => m.modelid === asset.modelid)?.modelname : null;
  const categoryName = asset.assetcategorytypeid ? categories.find((c) => c.assetcategorytypeid === asset.assetcategorytypeid)?.assetcategorytypename : null;
  const supplierName = asset.supplierid ? suppliers.find((s) => s.supplierid === asset.supplierid)?.suppliername : null;

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Assets", href: "/assets" },
    { label: asset.assetname, href: `/assets/${asset.assetid}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <div className="flex flex-col w-full h-full overflow-hidden">
        <AssetDetailHeader asset={asset} statuses={status} users={users} userAssets={userAssets} />
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Summary</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-foreground-500">Asset ID</dt><dd className="font-medium text-foreground">{asset.assetid}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Category</dt><dd className="font-medium text-foreground">{categoryName || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Status</dt><dd className="font-medium text-foreground">{statusName || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Requestable</dt><dd className="font-medium">{booleanPill(Boolean(asset.requestable))}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Mobile</dt><dd className="font-medium">{booleanPill(Boolean(asset.mobile))}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Location</dt><dd className="font-medium">{location ? location.locationname : "-"}</dd></div>
            </dl>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Specifications</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-foreground-500">Manufacturer</dt><dd className="font-medium">{manufacturerName || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Model</dt><dd className="font-medium">{modelName || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Specs</dt><dd className="font-medium text-right max-w-[60%] truncate" title={asset.specs || undefined}>{asset.specs || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Notes</dt><dd className="font-medium text-right max-w-[60%] truncate" title={asset.notes || undefined}>{asset.notes || "-"}</dd></div>
            </dl>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Procurement</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-foreground-500">Supplier</dt><dd className="font-medium">{supplierName || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Purchase Price</dt><dd className="font-medium">{asCurrency(asset.purchaseprice)}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Created</dt><dd className="font-medium">{asset.creation_date ? new Date(asset.creation_date).toLocaleString() : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Updated</dt><dd className="font-medium">{asset.change_date ? new Date(asset.change_date).toLocaleString() : "-"}</dd></div>
            </dl>
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Assigned User</h2>
            {assignedUser ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-medium">{assignedUser.firstname} {assignedUser.lastname}</span>
                  <span className="text-sm text-foreground-500">{assignedUser.email || "No email"}</span>
                </div>
                <Link href={`/user/${assignedUser.userid}`} className="text-primary text-sm font-medium hover:underline">View</Link>
              </div>
            ) : (
              <p className="text-sm text-foreground-500">No user assigned.</p>
            )}
          </section>

          <section className="col-span-2 rounded-lg border border-dashed border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Identifiers</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="flex justify-between"><span className="text-foreground-500">Asset Tag</span><span className="font-medium">{asset.assettag}</span></div>
              <div className="flex justify-between"><span className="text-foreground-500">Serial Number</span><span className="font-medium">{asset.serialnumber}</span></div>
            </div>
          </section>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Asset History</h2>
          <Separator className="my-3" />
          <p className="text-sm text-foreground-500">No history available yet.</p>
        </div>
      </div>
    </>
  );
}
