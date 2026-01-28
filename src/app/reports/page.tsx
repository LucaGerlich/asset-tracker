import { redirect } from "next/navigation";
import { auth } from "@/auth";
import ReportsPage from "./ui/ReportsPage";
import Breadcrumb from "@/components/Breadcrumb";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Reports - Asset Tracker",
  description: "View analytics and generate reports",
};

async function getReportData() {
  const [
    assets,
    users,
    accessories,
    licenses,
    consumables,
    userAssets,
    categories,
    statuses,
    locations,
    manufacturers,
  ] = await Promise.all([
    prisma.asset.findMany({
      include: {
        assetCategoryType: true,
        statusType: true,
        location: true,
        manufacturer: true,
      },
    }),
    prisma.user.findMany(),
    prisma.accessories.findMany(),
    prisma.licence.findMany(),
    prisma.consumable.findMany(),
    prisma.userAssets.findMany(),
    prisma.assetCategoryType.findMany(),
    prisma.statusType.findMany(),
    prisma.location.findMany(),
    prisma.manufacturer.findMany(),
  ]);

  // Calculate asset value
  const totalAssetValue = assets.reduce(
    (sum, a) => sum + (a.purchaseprice ? Number(a.purchaseprice) : 0),
    0
  );

  // Assets by status
  const assetsByStatus = statuses.map((status) => ({
    name: status.statustypename,
    value: assets.filter((a) => a.statustypeid === status.statustypeid).length,
  }));

  // Assets by category
  const assetsByCategory = categories.map((category) => ({
    name: category.assetcategorytypename,
    value: assets.filter((a) => a.assetcategorytypeid === category.assetcategorytypeid).length,
  }));

  // Assets by location
  const assetsByLocation = locations.map((location) => ({
    name: location.locationname || "Unknown",
    value: assets.filter((a) => a.locationid === location.locationid).length,
  }));

  // Assets by manufacturer
  const assetsByManufacturer = manufacturers.map((manufacturer) => ({
    name: manufacturer.manufacturername,
    value: assets.filter((a) => a.manufacturerid === manufacturer.manufacturerid).length,
  }));

  // Asset utilization (assigned vs unassigned)
  const assignedAssetIds = new Set(userAssets.map((ua) => ua.assetid));
  const assignedCount = assets.filter((a) => assignedAssetIds.has(a.assetid)).length;
  const unassignedCount = assets.length - assignedCount;

  // Monthly acquisition data (last 12 months)
  const now = new Date();
  const monthlyAcquisitions = [];
  for (let i = 11; i >= 0; i--) {
    const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = assets.filter((a) => {
      if (!a.purchasedate) return false;
      const purchaseDate = new Date(a.purchasedate);
      return purchaseDate >= month && purchaseDate < nextMonth;
    }).length;
    monthlyAcquisitions.push({
      month: month.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      count,
    });
  }

  // Expiring licenses (next 90 days)
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const expiringLicenses = licenses.filter((l) => {
    if (!l.expirationdate) return false;
    const expDate = new Date(l.expirationdate);
    return expDate > now && expDate <= ninetyDaysFromNow;
  }).length;

  // Low stock consumables
  const lowStockConsumables = consumables.filter((c) => c.quantity <= c.minQuantity).length;

  return {
    summary: {
      totalAssets: assets.length,
      totalUsers: users.length,
      totalAccessories: accessories.length,
      totalLicenses: licenses.length,
      totalConsumables: consumables.length,
      totalAssetValue,
      assignedAssets: assignedCount,
      unassignedAssets: unassignedCount,
      expiringLicenses,
      lowStockConsumables,
    },
    charts: {
      assetsByStatus,
      assetsByCategory,
      assetsByLocation,
      assetsByManufacturer,
      monthlyAcquisitions,
      utilization: [
        { name: "Assigned", value: assignedCount },
        { name: "Unassigned", value: unassignedCount },
      ],
    },
    rawData: {
      assets: assets.map((a) => ({
        id: a.assetid,
        name: a.assetname,
        tag: a.assettag,
        serial: a.serialnumber,
        category: a.assetCategoryType?.assetcategorytypename || "N/A",
        status: a.statusType?.statustypename || "N/A",
        location: a.location?.locationname || "N/A",
        manufacturer: a.manufacturer?.manufacturername || "N/A",
        purchasePrice: a.purchaseprice ? Number(a.purchaseprice) : 0,
        purchaseDate: a.purchasedate ? new Date(a.purchasedate).toISOString() : null,
      })),
    },
  };
}

export default async function Page() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const reportData = await getReportData();

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Reports", href: "/reports" },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <ReportsPage data={reportData} />
    </>
  );
}
