import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageOff } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  getAccessoryById,
  getAccessoryCategories,
  getLocation,
  getManufacturers,
  getModel,
  getStatus,
  getSuppliers,
  getEntityHistory,
} from "@/lib/data";
import prisma from "@/lib/prisma";
import HistoryTimeline from "@/components/HistoryTimeline";
import EntityAttachments from "@/components/EntityAttachments";
import { LazyImage } from "@/components/LazyImage";
import { StatTile, DetailCard, KV } from "@/components/DetailPrimitives";

function asCurrency(value: number | null) {
  if (value == null) return "-";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export const metadata = {
  title: "Asset Tracker - Accessory Details",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  let accessoryRaw;
  try {
    accessoryRaw = await getAccessoryById(params.id);
  } catch {
    notFound();
  }

  const accessory = {
    ...accessoryRaw,
    purchaseprice:
      accessoryRaw.purchaseprice != null
        ? Number(accessoryRaw.purchaseprice)
        : null,
    purchasedate: accessoryRaw.purchasedate
      ? typeof accessoryRaw.purchasedate === "string"
        ? accessoryRaw.purchasedate
        : accessoryRaw.purchasedate.toISOString()
      : null,
    creation_date: accessoryRaw.creation_date
      ? typeof accessoryRaw.creation_date === "string"
        ? accessoryRaw.creation_date
        : accessoryRaw.creation_date.toISOString()
      : null,
    change_date: accessoryRaw.change_date
      ? typeof accessoryRaw.change_date === "string"
        ? accessoryRaw.change_date
        : accessoryRaw.change_date.toISOString()
      : null,
  };

  const [
    categories,
    statuses,
    locations,
    manufacturers,
    models,
    suppliers,
    historyEntries,
    primaryPhoto,
  ] = await Promise.all([
    getAccessoryCategories(),
    getStatus(),
    getLocation(),
    getManufacturers(),
    getModel(),
    getSuppliers(),
    getEntityHistory("accessory", params.id),
    prisma.accessory_attachments.findFirst({
      where: { accessoryId: params.id, mimeType: { startsWith: "image/" } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { filename: true, originalName: true },
    }),
  ]);

  const categoryName =
    categories.find(
      (c) => c.accessoriecategorytypeid === accessory.accessoriecategorytypeid,
    )?.accessoriecategorytypename ?? "-";
  const statusName =
    statuses.find((s) => s.statustypeid === accessory.statustypeid)
      ?.statustypename ?? "-";
  const locationName =
    locations.find((l) => l.locationid === accessory.locationid)
      ?.locationname ?? "-";
  const manufacturerName =
    manufacturers.find((m) => m.manufacturerid === accessory.manufacturerid)
      ?.manufacturername ?? "-";
  const modelName =
    models.find((m) => m.modelid === accessory.modelid)?.modelname ?? "-";
  const supplierName =
    suppliers.find((s) => s.supplierid === accessory.supplierid)
      ?.suppliername ?? "-";

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Accessories", href: "/accessories" },
    {
      label: accessory.accessoriename,
      href: `/accessories/${accessory.accessorieid}`,
    },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {accessory.accessoriename}
            </h1>
            {accessory.accessorietag && (
              <p className="text-foreground-500 mt-1 text-sm">
                Tag: {accessory.accessorietag}
              </p>
            )}
          </div>
          <Link
            href={`/accessories/${accessory.accessorieid}/edit`}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Edit
          </Link>
        </div>
        <Separator className="my-4" />

        {/* Hero: photo + meta + key metrics */}
        <div className="border-default-200 flex flex-col gap-5 rounded-xl border p-5 lg:flex-row">
          <div className="bg-default-100 relative h-44 w-full shrink-0 overflow-hidden rounded-lg lg:w-60">
            {primaryPhoto ? (
              <LazyImage
                src={`/api/attachments/file/${primaryPhoto.filename}?thumb=gallery`}
                alt={primaryPhoto.originalName || accessory.accessoriename}
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
                {categoryName}
              </span>
              <span className="text-foreground-300">·</span>
              <span className="text-foreground-500">{locationName}</span>
              {accessory.accessorietag ? (
                <>
                  <span className="text-foreground-300">·</span>
                  <span className="text-foreground-500">
                    Tag {accessory.accessorietag}
                  </span>
                </>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatTile label="Status">{statusName}</StatTile>
              <StatTile label="Value">
                {asCurrency(accessory.purchaseprice)}
              </StatTile>
              <StatTile label="Requestable">
                {accessory.requestable ? (
                  <Badge variant="success">Yes</Badge>
                ) : (
                  <Badge variant="muted">No</Badge>
                )}
              </StatTile>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <DetailCard title="Details">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Manufacturer">{manufacturerName}</KV>
              <KV label="Model">{modelName}</KV>
              <KV label="Supplier">{supplierName}</KV>
            </dl>
          </DetailCard>

          <DetailCard title="Procurement">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Purchase Price">
                {asCurrency(accessory.purchaseprice)}
              </KV>
              <KV label="Purchase Date">
                {accessory.purchasedate
                  ? new Date(accessory.purchasedate).toLocaleDateString()
                  : "-"}
              </KV>
              <KV label="Created">
                {accessory.creation_date
                  ? new Date(accessory.creation_date).toLocaleDateString()
                  : "-"}
              </KV>
              <KV label="Updated">
                {accessory.change_date
                  ? new Date(accessory.change_date).toLocaleDateString()
                  : "-"}
              </KV>
            </dl>
          </DetailCard>
        </div>

        <Separator className="my-6" />

        <div className="mb-6">
          <EntityAttachments
            entityType="accessory"
            entityId={accessory.accessorieid}
          />
        </div>

        <div>
          <h2 className="text-lg font-semibold">Accessory History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="accessory" />
        </div>
      </div>
    </>
  );
}
