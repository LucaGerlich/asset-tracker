import Link from "next/link";
import { ImageOff } from "lucide-react";
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
import { getComponentById, getEntityHistory } from "@/lib/data";
import HistoryTimeline from "@/components/HistoryTimeline";
import EntityAttachments from "@/components/EntityAttachments";
import ComponentDetailClient from "./ui/ComponentDetailClient";
import { LazyImage } from "@/components/LazyImage";
import { StatTile, DetailCard, KV } from "@/components/DetailPrimitives";

function asCurrency(value: unknown) {
  if (value == null) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(Number(value));
}

const STOCK_BADGE: Record<string, { label: string; className: string }> = {
  out_of_stock: { label: "Out of Stock", className: "bg-red-100 text-red-700" },
  low_stock: { label: "Low Stock", className: "bg-yellow-100 text-yellow-700" },
  in_stock: { label: "In Stock", className: "bg-green-100 text-green-700" },
  no_tracking: {
    label: "Not Tracked",
    className: "bg-default-100 text-default-700",
  },
};

export const metadata = {
  title: "Asset Tracker - Component Details",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const [component, historyEntries, primaryPhoto] = await Promise.all([
    getComponentById(params.id),
    getEntityHistory("component", params.id),
    prisma.component_attachments.findFirst({
      where: { componentId: params.id, mimeType: { startsWith: "image/" } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { filename: true, originalName: true },
    }),
  ]);

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

        {/* Hero: photo + meta + key metrics */}
        <div className="border-default-200 flex flex-col gap-5 rounded-xl border p-5 lg:flex-row">
          <div className="bg-default-100 relative h-44 w-full shrink-0 overflow-hidden rounded-lg lg:w-60">
            {primaryPhoto ? (
              <LazyImage
                src={`/api/attachments/file/${primaryPhoto.filename}?thumb=gallery`}
                alt={primaryPhoto.originalName || component.name}
                sizes="(min-width: 1024px) 240px, 100vw"
              />
            ) : (
              <div className="text-foreground-300 flex h-full w-full items-center justify-center">
                <ImageOff className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="text-foreground font-medium">
                {component.category?.name ?? "Uncategorized"}
              </span>
              {component.manufacturer ? (
                <>
                  <span className="text-foreground-300">·</span>
                  <span className="text-foreground-500">
                    {component.manufacturer.manufacturername}
                  </span>
                </>
              ) : null}
              {component.location ? (
                <>
                  <span className="text-foreground-300">·</span>
                  <span className="text-foreground-500">
                    {component.location.locationname}
                  </span>
                </>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Stock">
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STOCK_BADGE[stockStatus].className}`}
                >
                  {STOCK_BADGE[stockStatus].label}
                </span>
              </StatTile>
              <StatTile label="Remaining">
                {component.remainingQuantity} / {component.totalQuantity}
              </StatTile>
              <StatTile label="Min Threshold">{component.minQuantity}</StatTile>
              <StatTile label="Value">
                {asCurrency(component.purchasePrice)}
              </StatTile>
            </div>
          </div>
        </div>

        {/* Details + stock + checkout actions */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DetailCard title="Details">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Category">{component.category?.name ?? "-"}</KV>
              {component.serialNumber && (
                <KV label="Serial Number">{component.serialNumber}</KV>
              )}
              <KV label="Manufacturer">
                {component.manufacturer?.manufacturername ?? "-"}
              </KV>
              <KV label="Supplier">
                {component.supplier?.suppliername ?? "-"}
              </KV>
              <KV label="Location">
                {component.location?.locationname ?? "-"}
              </KV>
              <KV label="Purchase Price">
                {asCurrency(component.purchasePrice)}
              </KV>
              <KV label="Purchase Date">
                {component.purchaseDate
                  ? new Date(component.purchaseDate).toLocaleDateString()
                  : "-"}
              </KV>
            </dl>
          </DetailCard>

          <DetailCard title="Stock">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Remaining">{component.remainingQuantity}</KV>
              <KV label="Total">{component.totalQuantity}</KV>
              <KV label="Minimum Threshold">{component.minQuantity}</KV>
              <KV label="Checked Out">
                {component.totalQuantity - component.remainingQuantity}
              </KV>
            </dl>
          </DetailCard>

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

        <Separator className="my-6" />

        <div className="mb-6">
          <EntityAttachments entityType="component" entityId={component.id} />
        </div>

        <div>
          <h2 className="text-lg font-semibold">Component History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="component" />
        </div>
      </div>
    </>
  );
}
