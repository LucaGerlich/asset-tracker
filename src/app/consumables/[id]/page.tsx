import React from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prisma";
import {
  getConsumableById,
  getConsumableCategories,
  getManufacturers,
  getSuppliers,
} from "@/lib/data";
import ConsumableDetailClient from "./ui/ConsumableDetailClient";

export const metadata = {
  title: "Asset Tracker - Consumable Details",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const consumableRaw = await getConsumableById(params.id);

  const consumable = {
    ...consumableRaw,
    purchaseprice:
      consumableRaw.purchaseprice != null
        ? Number(consumableRaw.purchaseprice)
        : null,
    purchasedate: consumableRaw.purchasedate
      ? typeof consumableRaw.purchasedate === "string"
        ? consumableRaw.purchasedate
        : consumableRaw.purchasedate.toISOString()
      : null,
    creation_date: consumableRaw.creation_date
      ? typeof consumableRaw.creation_date === "string"
        ? consumableRaw.creation_date
        : consumableRaw.creation_date.toISOString()
      : null,
    change_date: consumableRaw.change_date
      ? typeof consumableRaw.change_date === "string"
        ? consumableRaw.change_date
        : consumableRaw.change_date.toISOString()
      : null,
  };

  const [categories, manufacturers, suppliers] = await Promise.all([
    getConsumableCategories(),
    getManufacturers(),
    getSuppliers(),
  ]);

  const categoryName =
    categories.find(
      (c) => c.consumablecategorytypeid === consumable.consumablecategorytypeid,
    )?.consumablecategorytypename ?? "-";
  const manufacturerName =
    manufacturers.find((m) => m.manufacturerid === consumable.manufacturerid)
      ?.manufacturername ?? "-";
  const supplierName =
    suppliers.find((s) => s.supplierid === consumable.supplierid)
      ?.suppliername ?? "-";

  // Fetch stock alert for this consumable
  const stockAlert = await prisma.stockAlert.findUnique({
    where: { consumableId: params.id },
  });

  // Fetch recent checkouts
  const checkouts = await prisma.consumable_checkouts.findMany({
    where: { consumableId: params.id },
    orderBy: { checkedOutAt: "desc" },
    take: 50,
    include: {
      user: {
        select: { userid: true, firstname: true, lastname: true },
      },
    },
  });

  // Fetch users for the checkout dialog
  const users = await prisma.user.findMany({
    select: { userid: true, firstname: true, lastname: true },
    orderBy: { firstname: "asc" },
  });

  const stockStatus = (() => {
    const qty = consumable.quantity ?? 0;
    const min = consumable.minQuantity ?? 0;
    if (min > 0 && qty <= 0) return "out_of_stock";
    if (min > 0 && qty <= min) return "low_stock";
    if (min > 0) return "in_stock";
    return "no_tracking";
  })();

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Consumables", href: "/consumables" },
    {
      label: consumable.consumablename,
      href: `/consumables/${consumable.consumableid}`,
    },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {consumable.consumablename}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              {categoryName} &bull; {manufacturerName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stockStatus === "out_of_stock" && (
              <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700">
                Out of Stock
              </span>
            )}
            {stockStatus === "low_stock" && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 px-2 py-1 text-xs font-medium text-yellow-700">
                Low Stock
              </span>
            )}
            {stockStatus === "in_stock" && (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                In Stock
              </span>
            )}
            <Link
              href={`/consumables/${consumable.consumableid}/edit`}
              className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              Edit
            </Link>
          </div>
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Details
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Category</dt>
                <dd className="font-medium">{categoryName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Manufacturer</dt>
                <dd className="font-medium">{manufacturerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Supplier</dt>
                <dd className="font-medium">{supplierName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Price</dt>
                <dd className="font-medium">
                  {consumable.purchaseprice != null
                    ? `$${consumable.purchaseprice.toFixed(2)}`
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Date</dt>
                <dd className="font-medium">
                  {consumable.purchasedate
                    ? new Date(consumable.purchasedate).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Created</dt>
                <dd className="font-medium">
                  {consumable.creation_date
                    ? new Date(consumable.creation_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Stock
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Current Quantity</dt>
                <dd className="text-lg font-medium">
                  {consumable.quantity ?? 0}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Minimum Threshold</dt>
                <dd className="font-medium">{consumable.minQuantity ?? 0}</dd>
              </div>
              {stockAlert && (
                <>
                  <Separator className="my-1" />
                  <div className="flex justify-between">
                    <dt className="text-foreground-500">Alert Min Threshold</dt>
                    <dd className="font-medium">{stockAlert.minThreshold}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-500">
                      Alert Critical Threshold
                    </dt>
                    <dd className="font-medium">
                      {stockAlert.criticalThreshold}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-500">Email Notify</dt>
                    <dd className="font-medium">
                      {stockAlert.emailNotify ? "Yes" : "No"}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-foreground-500">Last Alert</dt>
                    <dd className="font-medium">
                      {stockAlert.lastAlertSentAt
                        ? new Date(stockAlert.lastAlertSentAt).toLocaleString()
                        : "Never"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </section>

          <section className="col-span-1">
            <ConsumableDetailClient
              consumableId={consumable.consumableid}
              currentQuantity={consumable.quantity ?? 0}
              users={users}
              checkouts={checkouts.map((c) => ({
                id: c.id,
                quantity: c.quantity,
                notes: c.notes,
                checkedOutAt: c.checkedOutAt.toISOString(),
                user: c.user,
              }))}
              hasStockAlert={!!stockAlert}
            />
          </section>
        </div>

        <Separator className="my-6" />

        <section className="border-default-200 rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-foreground-600 text-sm font-semibold">
              Checkout History
            </h2>
            <span className="text-foreground-500 text-xs">
              {checkouts.length} records
            </span>
          </div>
          {checkouts.length === 0 ? (
            <p className="text-foreground-500 text-sm">
              No checkouts recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-foreground-500 text-left">
                  <tr>
                    <th className="py-2 pr-4 font-normal">User</th>
                    <th className="py-2 pr-4 font-normal">Qty</th>
                    <th className="py-2 pr-4 font-normal">Date</th>
                    <th className="py-2 pr-4 font-normal">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {checkouts.map((c) => (
                    <tr key={c.id} className="border-default-200 border-t">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/user/${c.user.userid}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {c.user.firstname} {c.user.lastname}
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{c.quantity}</td>
                      <td className="py-2 pr-4">
                        {new Date(c.checkedOutAt).toLocaleString()}
                      </td>
                      <td className="text-foreground-500 py-2 pr-4">
                        {c.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
