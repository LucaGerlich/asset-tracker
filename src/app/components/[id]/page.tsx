import React from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import prisma from "@/lib/prisma";
import { getComponentById } from "@/lib/data";
import ComponentDetailClient from "./ui/ComponentDetailClient";

export const metadata = {
  title: "Asset Tracker - Component Details",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const component = await getComponentById(params.id);

  const assets = await prisma.asset.findMany({
    select: { assetid: true, assetname: true, assettag: true },
    orderBy: { assetname: "asc" },
  });

  const stockStatus = (() => {
    const qty = component.remainingQuantity ?? 0;
    const min = component.minQuantity ?? 0;
    if (min > 0 && qty <= 0) return "out_of_stock";
    if (min > 0 && qty <= min) return "low_stock";
    if (min > 0) return "in_stock";
    return "no_tracking";
  })();

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Components", href: "/components" },
    { label: component.name, href: `/components/${component.id}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex flex-col w-full h-full overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{component.name}</h1>
            <p className="text-sm text-foreground-500 mt-1">
              {component.category?.name ?? "No Category"}{" "}
              {component.manufacturer && <>&#8226; {component.manufacturer.manufacturername}</>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {stockStatus === "out_of_stock" && (
              <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-1 text-xs font-medium">
                Out of Stock
              </span>
            )}
            {stockStatus === "low_stock" && (
              <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2 py-1 text-xs font-medium">
                Low Stock
              </span>
            )}
            {stockStatus === "in_stock" && (
              <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-1 text-xs font-medium">
                In Stock
              </span>
            )}
            <Link
              href={`/components/${component.id}/edit`}
              className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              Edit
            </Link>
          </div>
        </div>
        <Separator className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Details</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Category</dt>
                <dd className="font-medium">{component.category?.name ?? "-"}</dd>
              </div>
              {component.serialNumber && (
                <div className="flex justify-between">
                  <dt className="text-foreground-500">Serial Number</dt>
                  <dd className="font-medium">{component.serialNumber}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-foreground-500">Manufacturer</dt>
                <dd className="font-medium">
                  {component.manufacturer?.manufacturername ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Supplier</dt>
                <dd className="font-medium">
                  {component.supplier?.suppliername ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Location</dt>
                <dd className="font-medium">
                  {component.location?.locationname ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Price</dt>
                <dd className="font-medium">
                  {component.purchasePrice != null
                    ? `$${Number(component.purchasePrice).toFixed(2)}`
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Date</dt>
                <dd className="font-medium">
                  {component.purchaseDate
                    ? new Date(component.purchaseDate).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Stock</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Remaining Quantity</dt>
                <dd className="font-medium text-lg">{component.remainingQuantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Total Quantity</dt>
                <dd className="font-medium">{component.totalQuantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Minimum Threshold</dt>
                <dd className="font-medium">{component.minQuantity}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Checked Out</dt>
                <dd className="font-medium">
                  {component.totalQuantity - component.remainingQuantity}
                </dd>
              </div>
            </dl>
          </section>

          <section className="col-span-1">
            <ComponentDetailClient
              componentId={component.id}
              remainingQuantity={component.remainingQuantity}
              assets={assets}
              checkouts={component.checkouts
                .filter((c) => !c.returnedAt)
                .map((c) => ({
                  id: c.id,
                  quantity: c.quantity,
                  notes: c.notes,
                  checkedOutAt: c.checkedOutAt.toISOString(),
                  asset: c.asset,
                  checkedOutByUser: c.checkedOutByUser,
                }))}
            />
          </section>
        </div>

        <Separator className="my-6" />

        <section className="rounded-lg border border-default-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground-600">Checkout History</h2>
            <span className="text-xs text-foreground-500">
              {component.checkouts.length} records
            </span>
          </div>
          {component.checkouts.length === 0 ? (
            <p className="text-sm text-foreground-500">No checkouts recorded.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-foreground-500">
                  <tr>
                    <th className="py-2 pr-4 font-normal">Asset</th>
                    <th className="py-2 pr-4 font-normal">Qty</th>
                    <th className="py-2 pr-4 font-normal">Checked Out</th>
                    <th className="py-2 pr-4 font-normal">Returned</th>
                    <th className="py-2 pr-4 font-normal">By</th>
                    <th className="py-2 pr-4 font-normal">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {component.checkouts.map((c) => (
                    <tr key={c.id} className="border-t border-default-200">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/assets/${c.asset.assetid}`}
                          className="text-primary hover:underline font-medium"
                        >
                          {c.asset.assetname} ({c.asset.assettag})
                        </Link>
                      </td>
                      <td className="py-2 pr-4">{c.quantity}</td>
                      <td className="py-2 pr-4">
                        {new Date(c.checkedOutAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4">
                        {c.returnedAt
                          ? new Date(c.returnedAt).toLocaleString()
                          : "-"}
                      </td>
                      <td className="py-2 pr-4">
                        {c.checkedOutByUser.firstname} {c.checkedOutByUser.lastname}
                      </td>
                      <td className="py-2 pr-4 text-foreground-500">
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
