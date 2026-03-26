import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  getLicenceById,
  getLicenceCategories,
  getManufacturers,
  getSuppliers,
  getEntityHistory,
} from "@/lib/data";
import HistoryTimeline from "@/components/HistoryTimeline";

export const metadata = {
  title: "Asset Tracker - Licence Details",
};

function getExpiryStatus(expirationdate: string | null): {
  label: string;
  variant: "success" | "destructive" | "warning" | "muted";
} {
  if (!expirationdate) {
    return { label: "No Expiry", variant: "muted" };
  }

  const now = new Date();
  const expiry = new Date(expirationdate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: "Expired", variant: "destructive" };
  }
  if (diffDays <= 30) {
    return { label: "Expiring Soon", variant: "warning" };
  }
  return { label: "Active", variant: "success" };
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;

  let licenceRaw;
  try {
    licenceRaw = await getLicenceById(params.id);
  } catch {
    notFound();
  }

  const licence = {
    ...licenceRaw,
    purchaseprice:
      licenceRaw.purchaseprice != null
        ? Number(licenceRaw.purchaseprice)
        : null,
    purchasedate: licenceRaw.purchasedate
      ? typeof licenceRaw.purchasedate === "string"
        ? licenceRaw.purchasedate
        : licenceRaw.purchasedate.toISOString()
      : null,
    expirationdate: licenceRaw.expirationdate
      ? typeof licenceRaw.expirationdate === "string"
        ? licenceRaw.expirationdate
        : licenceRaw.expirationdate.toISOString()
      : null,
    creation_date: licenceRaw.creation_date
      ? typeof licenceRaw.creation_date === "string"
        ? licenceRaw.creation_date
        : licenceRaw.creation_date.toISOString()
      : null,
    change_date: licenceRaw.change_date
      ? typeof licenceRaw.change_date === "string"
        ? licenceRaw.change_date
        : licenceRaw.change_date.toISOString()
      : null,
  };

  const [categories, manufacturers, suppliers, historyEntries] =
    await Promise.all([
      getLicenceCategories(),
      getManufacturers(),
      getSuppliers(),
      getEntityHistory("licence", params.id),
    ]);

  const categoryName =
    categories.find(
      (c) => c.licencecategorytypeid === licence.licencecategorytypeid,
    )?.licencecategorytypename ?? "-";
  const manufacturerName =
    manufacturers.find((m) => m.manufacturerid === licence.manufacturerid)
      ?.manufacturername ?? "-";
  const supplierName =
    suppliers.find((s) => s.supplierid === licence.supplierid)?.suppliername ??
    "-";

  const expiryStatus = getExpiryStatus(licence.expirationdate);

  const breadcrumbLabel =
    licence.licencekey || licence.licensedtoemail || "Licence";

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Licences", href: "/licences" },
    {
      label: breadcrumbLabel,
      href: `/licences/${licence.licenceid}`,
    },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {licence.licencekey || "Untitled Licence"}
            </h1>
            {licence.licensedtoemail && (
              <p className="text-foreground-500 mt-1 text-sm">
                Licensed to {licence.licensedtoemail}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={expiryStatus.variant}>{expiryStatus.label}</Badge>
            <Link
              href={`/licences/${licence.licenceid}/edit`}
              className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
            >
              Edit
            </Link>
          </div>
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
                <dt className="text-foreground-500">Licensed To</dt>
                <dd className="font-medium">
                  {licence.licensedtoemail || "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Seat Count</dt>
                <dd className="font-medium">{licence.seatCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Requestable</dt>
                <dd className="font-medium">
                  {licence.requestable ? "Yes" : "No"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Price</dt>
                <dd className="font-medium">
                  {licence.purchaseprice != null
                    ? new Intl.NumberFormat(undefined, {
                        style: "currency",
                        currency: "USD",
                      }).format(licence.purchaseprice)
                    : "-"}
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
                <dt className="text-foreground-500">Supplier</dt>
                <dd className="font-medium">{supplierName}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Licence Key</dt>
                <dd className="font-mono font-medium">
                  {licence.licencekey || "-"}
                </dd>
              </div>
            </dl>
          </section>

          {/* Dates */}
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Dates
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">Purchase Date</dt>
                <dd className="font-medium">
                  {licence.purchasedate
                    ? new Date(licence.purchasedate).toLocaleDateString()
                    : "-"}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-foreground-500">Expiration Date</dt>
                <dd className="flex items-center gap-2 font-medium">
                  {licence.expirationdate
                    ? new Date(licence.expirationdate).toLocaleDateString()
                    : "-"}
                  <Badge variant={expiryStatus.variant} className="text-[10px]">
                    {expiryStatus.label}
                  </Badge>
                </dd>
              </div>
              <Separator className="my-1" />
              <div className="flex justify-between">
                <dt className="text-foreground-500">Created</dt>
                <dd className="font-medium">
                  {licence.creation_date
                    ? new Date(licence.creation_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Updated</dt>
                <dd className="font-medium">
                  {licence.change_date
                    ? new Date(licence.change_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Notes */}
        {licence.notes && (
          <>
            <Separator className="my-6" />
            <section className="border-default-200 rounded-lg border p-4">
              <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
                Notes
              </h2>
              <p className="text-sm whitespace-pre-wrap">{licence.notes}</p>
            </section>
          </>
        )}

        <Separator className="my-6" />

        <div>
          <h2 className="text-lg font-semibold">Licence History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="licence" />
        </div>
      </div>
    </>
  );
}
