import React from "react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{component.name}</h1>
            <p className="text-foreground-500 mt-1 text-sm">
              {component.category?.name ?? "No Category"}{" "}
              {component.manufacturer && (
                <>&#8226; {component.manufacturer.manufacturername}</>
              )}
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
              href={`/components/${component.id}/edit`}
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
                <dd className="font-medium">
                  {component.category?.name ?? "-"}
                </dd>
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

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Stock
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Remaining Quantity</dt>
                <dd className="text-lg font-medium">
                  {component.remainingQuantity}
                </dd>
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

        <section className="border-default-200 rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-foreground-600 text-sm font-semibold">
              Checkout History
            </h2>
            <span className="text-foreground-500 text-xs">
              {component.checkouts.length} records
            </span>
          </div>
          {component.checkouts.length === 0 ? (
            <p className="text-foreground-500 text-sm">
              No checkouts recorded.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-normal">Asset</TableHead>
                    <TableHead className="font-normal">Qty</TableHead>
                    <TableHead className="font-normal">Checked Out</TableHead>
                    <TableHead className="font-normal">Returned</TableHead>
                    <TableHead className="font-normal">By</TableHead>
                    <TableHead className="font-normal">Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {component.checkouts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/assets/${c.asset.assetid}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {c.asset.assetname} ({c.asset.assettag})
                        </Link>
                      </TableCell>
                      <TableCell>{c.quantity}</TableCell>
                      <TableCell>
                        {new Date(c.checkedOutAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {c.returnedAt
                          ? new Date(c.returnedAt).toLocaleString()
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {c.checkedOutByUser.firstname}{" "}
                        {c.checkedOutByUser.lastname}
                      </TableCell>
                      <TableCell className="text-foreground-500">
                        {c.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
