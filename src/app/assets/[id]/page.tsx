import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import HistoryTimeline from "@/components/HistoryTimeline";
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
} from "@/lib/data";
import prisma from "@/lib/prisma";
import {
  calculateDepreciation,
  formatCurrency,
  getMethodDisplayName,
  type DepreciationMethod,
} from "@/lib/depreciation";
import AssetDetailHeader from "./ui/AssetDetailHeader";
import AssetAttachments from "@/components/AssetAttachments";
import AssetLifecycle from "./ui/AssetLifecycle";
import AssetReservations from "./ui/AssetReservations";
import AssetTransfers from "./ui/AssetTransfers";
import AssetCheckoutHistory from "./ui/AssetCheckoutHistory";

export const metadata = {
  title: "Asset Tracker - Asset Details",
  description: "Asset management tool",
};

function asCurrency(value) {
  if (value == null) return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return String(value);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);
}

function booleanPill(val) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${val ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}
    >
      {val ? "Yes" : "No"}
    </span>
  );
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  // First: fetch the asset (needed by subsequent queries)
  let assetRaw;
  try {
    assetRaw = await getAssetById(params.id);
  } catch {
    notFound();
  }
  const asset = {
    ...assetRaw,
    purchaseprice:
      assetRaw.purchaseprice !== null && assetRaw.purchaseprice !== undefined
        ? Number(assetRaw.purchaseprice)
        : null,
  };

  // Then: fetch all independent data in parallel
  const [
    location,
    users,
    status,
    manufacturers,
    models,
    categories,
    suppliers,
    userAssets,
    historyEntries,
    depreciationSettings,
    maintenanceSchedules,
    customFieldDefs,
    customFieldValues,
  ] = await Promise.all([
    asset?.locationid ? getLocationById(asset.locationid) : null,
    getUsers(),
    getStatus(),
    getManufacturers(),
    getModel(),
    getCategories(),
    getSuppliers(),
    getUserAssets(),
    prisma.audit_logs.findMany({
      where: { entity: "asset", entityId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: {
          select: {
            userid: true,
            username: true,
            firstname: true,
            lastname: true,
          },
        },
      },
    }),
    asset.assetcategorytypeid
      ? prisma.depreciation_settings.findUnique({
          where: { categoryId: asset.assetcategorytypeid },
        })
      : null,
    prisma.maintenance_schedules.findMany({
      where: { assetId: params.id },
      include: {
        user: { select: { userid: true, firstname: true, lastname: true } },
      },
      orderBy: { nextDueDate: "asc" },
      take: 5,
    }),
    prisma.custom_field_definitions.findMany({
      where: { entityType: "asset", isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.custom_field_values.findMany({
      where: { entityId: params.id },
    }),
  ]);

  // Compute depreciation if we have settings and a purchase price
  let depreciationData: {
    currentValue: number;
    accumulatedDepreciation: number;
    percentDepreciated: number;
  } | null = null;
  if (
    depreciationSettings &&
    asset.purchaseprice != null &&
    asset.creation_date
  ) {
    const result = calculateDepreciation({
      purchasePrice: asset.purchaseprice,
      purchaseDate: new Date(asset.creation_date),
      method: depreciationSettings.method as DepreciationMethod,
      usefulLifeYears: depreciationSettings.usefulLifeYears,
      salvagePercent: Number(depreciationSettings.salvagePercent),
    });
    depreciationData = result;
  }

  // Compute warranty status
  let warrantyStatus: { label: string; color: string } | null = null;
  if (asset.warrantyExpires) {
    const now = new Date();
    const expires = new Date(asset.warrantyExpires);
    const daysUntilExpiry = Math.ceil(
      (expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (daysUntilExpiry < 0) {
      warrantyStatus = { label: "Expired", color: "bg-red-100 text-red-700" };
    } else if (daysUntilExpiry <= 90) {
      warrantyStatus = {
        label: `Expiring Soon (${daysUntilExpiry}d)`,
        color: "bg-yellow-100 text-yellow-700",
      };
    } else {
      warrantyStatus = {
        label: "Active",
        color: "bg-green-100 text-green-700",
      };
    }
  }
  const cfValueMap = new Map(
    customFieldValues.map((v) => [v.fieldId, v.value]),
  );
  const customFields = customFieldDefs.map((def) => ({
    name: def.name,
    fieldType: def.fieldType,
    value: cfValueMap.get(def.id) ?? null,
  }));

  const userByAsset = userAssets.find((ua) => ua.assetid === asset.assetid);
  const assignedUser = userByAsset
    ? users.find((u) => u.userid === userByAsset.userid)
    : null;

  const statusName = asset.statustypeid
    ? status.find((s) => s.statustypeid === asset.statustypeid)?.statustypename
    : null;
  const manufacturerName = asset.manufacturerid
    ? manufacturers.find((m) => m.manufacturerid === asset.manufacturerid)
        ?.manufacturername
    : null;
  const modelName = asset.modelid
    ? models.find((m) => m.modelid === asset.modelid)?.modelname
    : null;
  const categoryName = asset.assetcategorytypeid
    ? categories.find(
        (c) => c.assetcategorytypeid === asset.assetcategorytypeid,
      )?.assetcategorytypename
    : null;
  const supplierName = asset.supplierid
    ? suppliers.find((s) => s.supplierid === asset.supplierid)?.suppliername
    : null;

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Assets", href: "/assets" },
    { label: asset.assetname, href: `/assets/${asset.assetid}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <div className="flex h-full w-full flex-col overflow-hidden">
        <AssetDetailHeader
          asset={asset}
          statuses={status}
          users={users}
          userAssets={userAssets}
        />
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Summary
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Asset ID</dt>
                <dd className="text-foreground font-medium">{asset.assetid}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Category</dt>
                <dd className="text-foreground font-medium">
                  {categoryName || "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Status</dt>
                <dd className="text-foreground font-medium">
                  {statusName || "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Requestable</dt>
                <dd className="font-medium">
                  {booleanPill(Boolean(asset.requestable))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Mobile</dt>
                <dd className="font-medium">
                  {booleanPill(Boolean(asset.mobile))}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Location</dt>
                <dd className="font-medium">
                  {location ? location.locationname : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Specifications
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Manufacturer</dt>
                <dd className="font-medium">{manufacturerName || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Model</dt>
                <dd className="font-medium">{modelName || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Specs</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium"
                  title={asset.specs || undefined}
                >
                  {asset.specs || "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Notes</dt>
                <dd
                  className="max-w-[60%] truncate text-right font-medium"
                  title={asset.notes || undefined}
                >
                  {asset.notes || "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Procurement
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Supplier</dt>
                <dd className="font-medium">{supplierName || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Price</dt>
                <dd className="font-medium">
                  {asCurrency(asset.purchaseprice)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Created</dt>
                <dd className="font-medium">
                  {asset.creation_date
                    ? new Date(asset.creation_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Updated</dt>
                <dd className="font-medium">
                  {asset.change_date
                    ? new Date(asset.change_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Assigned User
            </h2>
            {assignedUser ? (
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {assignedUser.firstname} {assignedUser.lastname}
                  </span>
                  <span className="text-foreground-500 text-sm">
                    {assignedUser.email || "No email"}
                  </span>
                </div>
                <Link
                  href={`/user/${assignedUser.userid}`}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  View
                </Link>
              </div>
            ) : (
              <p className="text-foreground-500 text-sm">No user assigned.</p>
            )}
          </section>

          <section className="border-default-200 col-span-2 rounded-lg border border-dashed p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Identifiers
            </h2>
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-foreground-500">Asset Tag</span>
                <span className="font-medium">{asset.assettag}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-foreground-500">Serial Number</span>
                <span className="font-medium">{asset.serialnumber}</span>
              </div>
            </div>
          </section>
        </div>

        {customFields.length > 0 && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <section className="border-default-200 col-span-1 rounded-lg border p-4">
              <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
                Custom Fields
              </h2>
              <dl className="grid grid-cols-1 gap-2 text-sm">
                {customFields.map((cf) => (
                  <div key={cf.name} className="flex justify-between">
                    <dt className="text-foreground-500">{cf.name}</dt>
                    <dd className="font-medium">
                      {cf.fieldType === "checkbox"
                        ? cf.value === "true"
                          ? "Yes"
                          : "No"
                        : cf.value || "-"}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Warranty
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Status</dt>
                <dd className="font-medium">
                  {warrantyStatus ? (
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${warrantyStatus.color}`}
                    >
                      {warrantyStatus.label}
                    </span>
                  ) : (
                    <span className="text-foreground-400">No warranty</span>
                  )}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Duration</dt>
                <dd className="font-medium">
                  {asset.warrantyMonths
                    ? `${asset.warrantyMonths} months`
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Expires</dt>
                <dd className="font-medium">
                  {asset.warrantyExpires
                    ? new Date(asset.warrantyExpires).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Depreciation
            </h2>
            {depreciationData && depreciationSettings ? (
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-foreground-500">Method</dt>
                  <dd className="font-medium">
                    {getMethodDisplayName(
                      depreciationSettings.method as DepreciationMethod,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-500">Useful Life</dt>
                  <dd className="font-medium">
                    {depreciationSettings.usefulLifeYears} years
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-500">Current Value</dt>
                  <dd className="font-medium text-green-700">
                    {formatCurrency(depreciationData.currentValue)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-foreground-500">Depreciated</dt>
                  <dd className="font-medium text-red-600">
                    {formatCurrency(depreciationData.accumulatedDepreciation)} (
                    {depreciationData.percentDepreciated.toFixed(1)}%)
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-foreground-500 text-sm">
                {asset.purchaseprice == null
                  ? "No purchase price set."
                  : "No depreciation settings for this category."}
              </p>
            )}
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Maintenance
            </h2>
            {maintenanceSchedules.length > 0 ? (
              <div className="space-y-2">
                {maintenanceSchedules.map((schedule) => {
                  const isDue = new Date(schedule.nextDueDate) <= new Date();
                  return (
                    <div
                      key={schedule.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{schedule.title}</p>
                        <p className="text-foreground-500 text-xs">
                          {schedule.frequency} &middot;{" "}
                          {schedule.user
                            ? `${schedule.user.firstname} ${schedule.user.lastname}`
                            : "Unassigned"}
                        </p>
                      </div>
                      <span
                        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${isDue ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"}`}
                      >
                        {isDue
                          ? "Due"
                          : new Date(schedule.nextDueDate).toLocaleDateString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-foreground-500 text-sm">
                No maintenance schedules.
              </p>
            )}
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4 md:col-span-3">
            <AssetLifecycle
              assetId={asset.assetid}
              currentStatus={statusName}
              isAssigned={!!assignedUser}
              statuses={status}
            />
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
          <section className="border-default-200 overflow-hidden rounded-lg border p-4">
            <AssetReservations
              assetId={asset.assetid}
              assetName={asset.assetname}
            />
          </section>
          <section className="border-default-200 overflow-hidden rounded-lg border p-4">
            <AssetTransfers
              assetId={asset.assetid}
              currentUserId={userByAsset?.userid}
              currentLocationId={asset.locationid ?? undefined}
              currentOrgId={asset.organizationId ?? undefined}
            />
          </section>
          <section className="border-default-200 overflow-hidden rounded-lg border p-4 md:col-span-2">
            <AssetCheckoutHistory
              assetId={asset.assetid}
              assetName={asset.assetname}
            />
          </section>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="col-span-1 md:col-span-2">
            <AssetAttachments assetId={asset.assetid} />
          </div>
        </div>

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Asset History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="asset" />
        </div>
      </div>
    </>
  );
}
