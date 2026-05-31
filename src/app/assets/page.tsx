import Breadcrumb from "@/components/Breadcrumb";
import AssetsTableClient from "./ui/AssetsTableClient";
import {
  getAssets,
  getLocation,
  getUsers,
  getStatus,
  getManufacturers,
  getModel,
  getCategories,
  getUserAssets,
} from "@/lib/data";
import { getOrganizationContext } from "@/lib/organization-context";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Asset Tracker - Assets",
  description: "Asset management tool",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const columns = [
    { name: "ID", uid: "assetid" },
    { name: "NAME", uid: "assetname", sortable: true },
    { name: "TAG", uid: "assettag", sortable: true },
    { name: "SERIAL", uid: "serialnumber" },
    { name: "BELONGS TO", uid: "belongsto", sortable: true },
    { name: "MANUFACTUERER", uid: "manufacturerid", sortable: true },
    { name: "MODEL", uid: "modelid", sortable: true },
    { name: "SPECS", uid: "specs" },
    { name: "NOTES", uid: "notes" },
    { name: "STATUS", uid: "statustypeid", sortable: true },
    { name: "CATEGORY", uid: "assetcategorytypeid", sortable: true },
    { name: "REQESTABLE", uid: "requestable", sortable: true },
    { name: "MOBILE", uid: "mobile", sortable: true },
    { name: "LOCATION", uid: "locationid", sortable: true },
    { name: "PRICE", uid: "purchaseprice" },
    { name: "ACTIONS", uid: "actions" },
  ];

  const selectOptions = [
    { value: "20", label: "20" }, //startvalue
    { value: "25", label: "25" },
    { value: "50", label: "50" },
    { value: "75", label: "75" },
    { value: "100", label: "100" },
    { value: "all", label: "All" },
  ];

  const [
    databaseAssetsRaw,
    location,
    user,
    status,
    manufacturer,
    model,
    categories,
    userAssets,
  ] = await Promise.all([
    getAssets(),
    getLocation(),
    getUsers(),
    getStatus(),
    getManufacturers(),
    getModel(),
    getCategories(),
    getUserAssets(),
  ]);

  // Sanitize Prisma Decimals (purchaseprice) for client component props
  const databaseAssets = databaseAssetsRaw.map((a) => ({
    ...a,
    purchaseprice:
      a.purchaseprice !== null && a.purchaseprice !== undefined
        ? Number(a.purchaseprice)
        : null,
  }));

  // Self-service: non-admins see their assigned assets + all available assets
  let ctx;
  try {
    ctx = await getOrganizationContext();
  } catch {
    /* non-admin context resolution is optional */
  }
  const isAdmin = ctx?.isAdmin ?? false;

  let displayAssets = databaseAssets;
  if (!isAdmin && ctx?.userId) {
    const assignedAssetIds = new Set(
      userAssets
        .filter((ua) => ua.userid === ctx.userId)
        .map((ua) => ua.assetid),
    );
    const availableStatusIds = new Set(
      status
        .filter((s) => s.statustypename.toLowerCase().includes("available"))
        .map((s) => s.statustypeid),
    );
    // Also include assets the user has pending/approved requests for
    const requestedAssetIds = new Set(
      (
        await prisma.itemRequest.findMany({
          where: {
            userId: ctx.userId,
            entityType: "asset",
            status: { in: ["pending", "approved", "return_pending"] },
          },
          select: { entityId: true },
        })
      ).map((r) => r.entityId),
    );
    displayAssets = databaseAssets.filter(
      (a) =>
        assignedAssetIds.has(a.assetid) ||
        requestedAssetIds.has(a.assetid) ||
        (a.statustypeid && availableStatusIds.has(a.statustypeid)),
    );
  }

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Assets", href: "/assets" },
        ]}
      />
      <AssetsTableClient
        data={displayAssets}
        locations={location}
        user={user}
        status={status}
        manufacturers={manufacturer}
        models={model}
        categories={categories}
        columns={columns}
        selectOptions={selectOptions}
        userAssets={userAssets}
        isAdmin={isAdmin}
        currentUserId={ctx?.userId ?? null}
      ></AssetsTableClient>
    </div>
  );
}
