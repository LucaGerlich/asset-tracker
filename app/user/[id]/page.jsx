import React from "react";
import Link from "next/link";
import UserResources from "./ui/UserResources";
import Breadcrumb from "@/app/components/Breadcrumb";
import { Divider } from "@heroui/divider";
import {
  getUserById,
  getUserAssets,
  getAssets,
  getStatus,
  getAccessories,
  getUserAccessoires,
  getLicences,
} from "@/app/lib/data";

export const metadata = {
  title: "Asset Tracker - User Details",
  description: "Asset management tool",
};

export default async function Page(props) {
  const params = await props.params;
  const user = await getUserById(params.id);
  const [allAssets, links, statuses, allAccessoriesRaw, userAccLinks, licencesRaw] = await Promise.all([
    getAssets(),
    getUserAssets(),
    getStatus(),
    getAccessories(),
    getUserAccessoires(),
    getLicences(),
  ]);
  const allAccessories = allAccessoriesRaw.map((a) => ({
    ...a,
    purchaseprice: a.purchaseprice != null ? Number(a.purchaseprice) : null,
  }));
  const licences = licencesRaw.map((l) => ({
    ...l,
    purchaseprice: l.purchaseprice != null ? Number(l.purchaseprice) : null,
  }));
  const myAssetLinks = links.filter((l) => l.userid === user.userid);
  const myAssets = myAssetLinks
    .map((l) => allAssets.find((a) => a.assetid === l.assetid))
    .filter(Boolean);
  const myAccessories = userAccLinks
    .filter((l) => l.userid === user.userid)
    .map((l) => allAccessories.find((a) => a.accessorieid === l.accessorieid))
    .filter(Boolean);
  const myLicences = licences.filter((lic) => lic.licenceduserid === user.userid);

  const statusById = new Map(statuses.map((s) => [s.statustypeid, s.statustypename]));
  const statusColor = (name) => {
    const n = (name || "").toLowerCase();
    if (n === "active") return "bg-primary/10 text-primary";
    if (n === "available") return "bg-success-100 text-success-700";
    if (n === "pending") return "bg-warning-100 text-warning-700";
    if (n.includes("lost") || n.includes("stolen")) return "bg-danger-100 text-danger-700";
    return "bg-default-100 text-default-700";
  };

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Users", href: "/user" },
    { label: `${user.firstname} ${user.lastname}`, href: `/user/${user.userid}` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex flex-col w-full h-full overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{user.firstname} {user.lastname}</h1>
            <p className="text-sm text-foreground-500 mt-1">{user.email || "No email"}{user.username ? ` • @${user.username}` : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {user.isadmin ? (
              <span className="inline-flex items-center rounded-full bg-foreground-200/60 text-foreground px-2 py-1 text-xs font-medium">Admin</span>
            ) : null}
            {user.canrequest ? (
              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-1 text-xs font-medium">Can Request</span>
            ) : null}
            <Link href={`/user/${user.userid}/edit`} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90">
              Edit
            </Link>
          </div>
        </div>
        <Divider className="my-4" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Profile</h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between"><dt className="text-foreground-500">User ID</dt><dd className="font-medium">{user.userid}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">First Name</dt><dd className="font-medium">{user.firstname}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Last Name</dt><dd className="font-medium">{user.lastname}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Username</dt><dd className="font-medium">{user.username || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Language</dt><dd className="font-medium">{user.lan || "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Created</dt><dd className="font-medium">{user.creation_date ? new Date(user.creation_date).toLocaleString() : "-"}</dd></div>
              <div className="flex justify-between"><dt className="text-foreground-500">Updated</dt><dd className="font-medium">{user.change_date ? new Date(user.change_date).toLocaleString() : "-"}</dd></div>
            </dl>
          </section>

          <section className="col-span-2 rounded-lg border border-default-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground-600">Assigned Assets</h2>
              <span className="text-xs text-foreground-500">{myAssets.length} total</span>
            </div>
            {myAssets.length === 0 ? (
              <p className="text-sm text-foreground-500">No assets assigned.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-foreground-500">
                    <tr>
                      <th className="py-2 pr-4 font-normal">Name</th>
                      <th className="py-2 pr-4 font-normal">Tag</th>
                      <th className="py-2 pr-4 font-normal">Serial</th>
                      <th className="py-2 pr-4 font-normal">Status</th>
                      <th className="py-2 pr-4 font-normal">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myAssets.map((a) => (
                      <tr key={a.assetid} className="border-t border-default-200">
                        <td className="py-2 pr-4">
                          <Link href={`/assets/${a.assetid}`} className="text-primary hover:underline font-medium">
                            {a.assetname}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{a.assettag}</td>
                        <td className="py-2 pr-4">{a.serialnumber}</td>
                        <td className="py-2 pr-4">
                          {a.statustypeid ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(statusById.get(a.statustypeid))}`}>
                              {statusById.get(a.statustypeid)}
                            </span>
                          ) : "-"}
                        </td>
                        <td className="py-2 pr-4">
                          <Link href={`/assets/${a.assetid}`} className="text-foreground-600 hover:underline">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>

        <UserResources user={user} accessories={myAccessories} licences={myLicences} allAccessories={allAccessories} allLicences={licences} />
      </div>
    </>
  );
}
