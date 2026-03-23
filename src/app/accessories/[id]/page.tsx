import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
} from "@/lib/data";

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

  const [categories, statuses, locations, manufacturers, models, suppliers] =
    await Promise.all([
      getAccessoryCategories(),
      getStatus(),
      getLocation(),
      getManufacturers(),
      getModel(),
      getSuppliers(),
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

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Summary */}
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Summary
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Category</dt>
                <dd className="font-medium">{categoryName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Status</dt>
                <dd className="font-medium">{statusName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Location</dt>
                <dd className="font-medium">{locationName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Requestable</dt>
                <dd>
                  {accessory.requestable ? (
                    <Badge variant="success">Yes</Badge>
                  ) : (
                    <Badge variant="muted">No</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Details */}
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Details
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Manufacturer</dt>
                <dd className="font-medium">{manufacturerName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Model</dt>
                <dd className="font-medium">{modelName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Supplier</dt>
                <dd className="font-medium">{supplierName}</dd>
              </div>
            </dl>
          </section>

          {/* Procurement */}
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Procurement
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Price</dt>
                <dd className="font-medium">
                  {accessory.purchaseprice != null
                    ? new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "USD",
                      }).format(accessory.purchaseprice)
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Date</dt>
                <dd className="font-medium">
                  {accessory.purchasedate
                    ? new Date(accessory.purchasedate).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Created</dt>
                <dd className="font-medium">
                  {accessory.creation_date
                    ? new Date(accessory.creation_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Updated</dt>
                <dd className="font-medium">
                  {accessory.change_date
                    ? new Date(accessory.change_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </>
  );
}
