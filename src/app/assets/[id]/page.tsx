import Link from "next/link";
import { notFound } from "next/navigation";
import { Wrench, ImageOff } from "lucide-react";
import { LazyImage } from "@/components/LazyImage";
import {
  StatTile,
  DetailCard,
  KV,
  EmptyRow,
} from "@/components/DetailPrimitives";
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
  getEntityHistory,
} from "@/lib/data";
import prisma from "@/lib/prisma";
import {
  calculateDepreciation,
  formatCurrency,
  getMethodDisplayName,
  type DepreciationMethod,
} from "@/lib/depreciation";
import {
  calculateHealthScore,
  frequencyToDays,
  labelBgColor,
} from "@/lib/health-score";
import { getOrganizationContext } from "@/lib/organization-context";
import AssetDetailHeader from "./ui/AssetDetailHeader";
import AssetAttachments from "@/components/AssetAttachments";
import AssetLifecycle from "./ui/AssetLifecycle";
import AssetReservations from "./ui/AssetReservations";
import AssetTransfers from "./ui/AssetTransfers";
import AssetCheckoutHistory from "./ui/AssetCheckoutHistory";
import { CustomFieldValue } from "@/components/CustomFieldValue";
import ReturnItemButton from "@/components/ReturnItemButton";

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

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  let isAdmin = true;
  let ctx: Awaited<ReturnType<typeof getOrganizationContext>> = null;
  try {
    ctx = await getOrganizationContext();
    isAdmin = ctx?.isAdmin ?? true;
  } catch {
    /* non-admin context resolution is optional */
  }
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
    activeItemRequest,
    primaryPhoto,
  ] = await Promise.all([
    asset?.locationid ? getLocationById(asset.locationid) : null,
    getUsers(),
    getStatus(),
    getManufacturers(),
    getModel(),
    getCategories(),
    getSuppliers(),
    getUserAssets(),
    getEntityHistory("asset", params.id),
    asset.assetcategorytypeid
      ? prisma.depreciation_settings.findUnique({
          where: { categoryId: asset.assetcategorytypeid },
        })
      : null,
    prisma.maintenance_schedules.findMany({
      where: { assetId: params.id },
      include: {
        user: { select: { userid: true, firstname: true, lastname: true } },
        maintenance_logs: {
          orderBy: { completedAt: "desc" },
          take: 1,
          select: { completedAt: true },
        },
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
    // Find an active (approved) item request for this asset+user, for the Return button
    ctx?.userId
      ? prisma.itemRequest.findFirst({
          where: {
            entityType: "asset",
            entityId: params.id,
            userId: ctx.userId,
            status: "approved",
          },
        })
      : null,
    // Primary image for the hero (primary flag first, else most recent image)
    prisma.asset_attachments.findFirst({
      where: { assetId: params.id, mimeType: { startsWith: "image/" } },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "desc" }],
      select: { filename: true, originalName: true },
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
  // Compute health score from data already fetched
  const healthScoreMaintenanceData = (() => {
    if (maintenanceSchedules.length === 0)
      return { lastMaintenanceDate: null, maintenanceFrequencyDays: null };
    let lastDate: Date | null = null;
    let minFreqDays = Infinity;
    for (const schedule of maintenanceSchedules) {
      const freqDays = frequencyToDays(schedule.frequency);
      if (freqDays < minFreqDays) minFreqDays = freqDays;
      const log = schedule.maintenance_logs?.[0];
      if (log?.completedAt && (!lastDate || log.completedAt > lastDate)) {
        lastDate = log.completedAt;
      }
    }
    return {
      lastMaintenanceDate: lastDate,
      maintenanceFrequencyDays: minFreqDays === Infinity ? null : minFreqDays,
    };
  })();

  const healthScore = calculateHealthScore({
    purchaseDate: asset.purchasedate ? new Date(asset.purchasedate) : null,
    expectedEndOfLife: asset.expectedEndOfLife
      ? new Date(asset.expectedEndOfLife)
      : null,
    warrantyExpires: asset.warrantyExpires
      ? new Date(asset.warrantyExpires)
      : null,
    lastMaintenanceDate: healthScoreMaintenanceData.lastMaintenanceDate,
    maintenanceFrequencyDays:
      healthScoreMaintenanceData.maintenanceFrequencyDays,
    percentDepreciated: depreciationData?.percentDepreciated ?? null,
  });

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
          isAdmin={isAdmin}
        />
        <Separator className="my-4" />

        {/* Hero: photo + meta + key metrics */}
        <div className="border-default-200 flex flex-col gap-5 rounded-xl border p-5 lg:flex-row">
          <div className="bg-default-100 relative h-44 w-full shrink-0 overflow-hidden rounded-lg lg:w-60">
            {primaryPhoto ? (
              <LazyImage
                src={`/api/asset/attachments/file/${primaryPhoto.filename}?thumb=gallery`}
                alt={primaryPhoto.originalName || asset.assetname}
                sizes="(min-width: 1024px) 240px, 100vw"
              />
            ) : (
              <div className="text-foreground-300 flex h-full w-full items-center justify-center">
                <ImageOff className="h-8 w-8" />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="text-foreground font-medium">
                  {categoryName || "Uncategorized"}
                </span>
                <span className="text-foreground-300">·</span>
                <span className="text-foreground-500">
                  {location ? location.locationname : "No location"}
                </span>
                <span className="text-foreground-300">·</span>
                {assignedUser ? (
                  <span className="text-foreground-500">
                    Assigned to{" "}
                    <Link
                      href={`/user/${assignedUser.userid}`}
                      className="text-primary font-medium hover:underline"
                    >
                      {assignedUser.firstname} {assignedUser.lastname}
                    </Link>
                  </span>
                ) : (
                  <span className="text-foreground-400">Unassigned</span>
                )}
                {asset.requestable ? (
                  <>
                    <span className="text-foreground-300">·</span>
                    <span className="text-foreground-500">Requestable</span>
                  </>
                ) : null}
                {asset.mobile ? (
                  <>
                    <span className="text-foreground-300">·</span>
                    <span className="text-foreground-500">Mobile</span>
                  </>
                ) : null}
              </div>

              {!isAdmin && userByAsset?.userid === ctx?.userId && (
                <ReturnItemButton
                  requestId={activeItemRequest?.id}
                  entityId={asset.assetid}
                  entityName={asset.assetname}
                  entityType="asset"
                />
              )}
            </div>

            {/* Key metrics strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile label="Health">
                <span className="flex items-center gap-2">
                  {healthScore.overall}
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${labelBgColor(healthScore.label)}`}
                  >
                    {healthScore.label}
                  </span>
                </span>
              </StatTile>
              <StatTile label="Warranty">
                {warrantyStatus ? (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${warrantyStatus.color}`}
                  >
                    {warrantyStatus.label}
                  </span>
                ) : (
                  <span className="text-foreground-400">None</span>
                )}
              </StatTile>
              <StatTile label="Value">
                {depreciationData
                  ? formatCurrency(depreciationData.currentValue)
                  : asCurrency(asset.purchaseprice)}
              </StatTile>
              <StatTile label="Status">{statusName || "—"}</StatTile>
            </div>
          </div>
        </div>

        {/* Primary details */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DetailCard title="Specifications">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Manufacturer">{manufacturerName || "-"}</KV>
              <KV label="Model">{modelName || "-"}</KV>
              <KV label="Specs">
                <span title={asset.specs || undefined}>
                  {asset.specs || "-"}
                </span>
              </KV>
              <KV label="Notes">
                <span title={asset.notes || undefined}>
                  {asset.notes || "-"}
                </span>
              </KV>
            </dl>
          </DetailCard>

          <DetailCard title="Procurement">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Supplier">{supplierName || "-"}</KV>
              <KV label="Purchase Price">{asCurrency(asset.purchaseprice)}</KV>
              <KV label="Created">
                {asset.creation_date
                  ? new Date(asset.creation_date).toLocaleDateString()
                  : "-"}
              </KV>
              <KV label="Updated">
                {asset.change_date
                  ? new Date(asset.change_date).toLocaleDateString()
                  : "-"}
              </KV>
            </dl>
          </DetailCard>

          <DetailCard title="Identifiers">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Asset Tag">{asset.assettag || "-"}</KV>
              <KV label="Serial Number">{asset.serialnumber || "-"}</KV>
              <KV label="Asset ID">
                <span className="font-mono text-xs">
                  {asset.assetid.slice(0, 8)}…
                </span>
              </KV>
            </dl>
          </DetailCard>
        </div>

        {customFields.length > 0 && (
          <div className="mt-4">
            <DetailCard title="Custom Fields">
              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {customFields.map((cf) => (
                  <CustomFieldValue
                    key={cf.name}
                    name={cf.name}
                    fieldType={cf.fieldType}
                    value={cf.value}
                  />
                ))}
              </dl>
            </DetailCard>
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <DetailCard title="Health Breakdown">
            <dl className="grid grid-cols-1 gap-1.5 text-sm">
              <KV label="Age">{healthScore.ageFactor}/25</KV>
              <KV label="Warranty">{healthScore.warrantyFactor}/25</KV>
              <KV label="Maintenance">{healthScore.maintenanceFactor}/25</KV>
              <KV label="Depreciation">{healthScore.depreciationFactor}/25</KV>
            </dl>
          </DetailCard>

          <DetailCard title="Warranty">
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <KV label="Status">
                {warrantyStatus ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${warrantyStatus.color}`}
                  >
                    {warrantyStatus.label}
                  </span>
                ) : (
                  <span className="text-foreground-400">No warranty</span>
                )}
              </KV>
              <KV label="Duration">
                {asset.warrantyMonths ? `${asset.warrantyMonths} months` : "-"}
              </KV>
              <KV label="Expires">
                {asset.warrantyExpires
                  ? new Date(asset.warrantyExpires).toLocaleDateString()
                  : "-"}
              </KV>
            </dl>
          </DetailCard>

          <DetailCard title="Depreciation">
            {depreciationData && depreciationSettings ? (
              <dl className="grid grid-cols-1 gap-2 text-sm">
                <KV label="Method">
                  {getMethodDisplayName(
                    depreciationSettings.method as DepreciationMethod,
                  )}
                </KV>
                <KV label="Useful Life">
                  {depreciationSettings.usefulLifeYears} years
                </KV>
                <KV label="Current Value">
                  <span className="text-green-700">
                    {formatCurrency(depreciationData.currentValue)}
                  </span>
                </KV>
                <KV label="Depreciated">
                  <span className="text-red-600">
                    {formatCurrency(depreciationData.accumulatedDepreciation)} (
                    {depreciationData.percentDepreciated.toFixed(1)}%)
                  </span>
                </KV>
              </dl>
            ) : (
              <p className="text-foreground-500 text-sm">
                {asset.purchaseprice == null
                  ? "No purchase price set."
                  : "No depreciation settings for this category."}
              </p>
            )}
          </DetailCard>
        </div>

        {/* Maintenance */}
        <div className="mt-4">
          {maintenanceSchedules.length > 0 ? (
            <DetailCard title="Maintenance">
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
            </DetailCard>
          ) : (
            <EmptyRow icon={Wrench}>
              No maintenance schedules for this asset.
            </EmptyRow>
          )}
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4 md:col-span-3">
            <AssetLifecycle
              assetId={asset.assetid}
              currentStatus={statusName}
              isAssigned={!!assignedUser}
              statuses={status}
              isAdmin={isAdmin}
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
          {isAdmin && (
            <section className="border-default-200 overflow-hidden rounded-lg border p-4">
              <AssetTransfers
                assetId={asset.assetid}
                currentUserId={userByAsset?.userid}
                currentLocationId={asset.locationid ?? undefined}
                currentOrgId={asset.organizationId ?? undefined}
              />
            </section>
          )}
          {isAdmin && (
            <section className="border-default-200 overflow-hidden rounded-lg border p-4 md:col-span-2">
              <AssetCheckoutHistory
                assetId={asset.assetid}
                assetName={asset.assetname}
              />
            </section>
          )}
        </div>

        {isAdmin && (
          <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
            <div className="col-span-1 md:col-span-2">
              <AssetAttachments assetId={asset.assetid} />
            </div>
          </div>
        )}

        <div className="mt-10">
          <h2 className="text-lg font-semibold">Asset History</h2>
          <Separator className="my-3" />
          <HistoryTimeline entries={historyEntries} entityType="asset" />
        </div>
      </div>
    </>
  );
}
