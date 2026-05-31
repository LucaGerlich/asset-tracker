import { Suspense } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import AccessoriesTable from "../../ui/accessories/AccessoriesTable";
import {
  getAccessories,
  getManufacturers,
  getModel,
  getStatus,
  getLocation,
  getSuppliers,
  getAccessoryCategories,
  getUserAccessoires,
} from "@/lib/data";
import { getOrganizationContext } from "@/lib/organization-context";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Asset Tracker - Accessories",
  description: "Asset management tool",
};

export default async function Page() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) {
    redirect("/login");
  }
  const [
    accessoriesRaw,
    manufacturers,
    models,
    statuses,
    locations,
    suppliers,
    categories,
    userAccessoires,
  ] = await Promise.all([
    getAccessories(),
    getManufacturers(),
    getModel(),
    getStatus(),
    getLocation(),
    getSuppliers(),
    getAccessoryCategories(),
    getUserAccessoires(),
  ]);

  // Self-service: non-admins see their assigned accessories + all available
  let ctx;
  try {
    ctx = await getOrganizationContext();
  } catch {
    /* non-admin context resolution is optional */
  }
  const isAdmin = ctx?.isAdmin ?? false;

  let filteredAccessories = accessoriesRaw;
  if (!isAdmin && ctx?.userId) {
    const assignedAccessoryIds = new Set(
      userAccessoires
        .filter((ua) => ua.userid === ctx.userId)
        .map((ua) => ua.accessorieid),
    );
    const availableStatusIds = new Set(
      statuses
        .filter((s) => s.statustypename.toLowerCase().includes("available"))
        .map((s) => s.statustypeid),
    );
    filteredAccessories = accessoriesRaw.filter(
      (a) =>
        assignedAccessoryIds.has(a.accessorieid) ||
        (a.statustypeid && availableStatusIds.has(a.statustypeid)),
    );
  }

  return (
    <div>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Accessories", href: "/accessories" },
        ]}
      />
      <Suspense fallback={null}>
        <AccessoriesTable
          items={filteredAccessories.map((item) => ({
            ...item,
            purchaseprice:
              item.purchaseprice !== null && item.purchaseprice !== undefined
                ? Number(item.purchaseprice)
                : null,
            purchasedate: item.purchasedate
              ? typeof item.purchasedate === "string"
                ? item.purchasedate
                : item.purchasedate.toISOString()
              : null,
            creation_date: item.creation_date
              ? typeof item.creation_date === "string"
                ? item.creation_date
                : item.creation_date.toISOString()
              : null,
            change_date: item.change_date
              ? typeof item.change_date === "string"
                ? item.change_date
                : item.change_date.toISOString()
              : null,
          }))}
          manufacturers={manufacturers}
          models={models}
          statuses={statuses}
          categories={categories}
          locations={locations}
          suppliers={suppliers}
          isAdmin={isAdmin}
          currentUserId={ctx?.userId ?? null}
          userAccessoires={userAccessoires}
        />
      </Suspense>
    </div>
  );
}
