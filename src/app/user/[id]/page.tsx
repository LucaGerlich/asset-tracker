import React from "react";
import Link from "next/link";
import UserResources from "./ui/UserResources";
import Breadcrumb from "@/components/Breadcrumb";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import HistoryTimeline from "@/components/HistoryTimeline";
import prisma from "@/lib/prisma";
import {
  getUserById,
  getUserAssets,
  getAssets,
  getStatus,
  getAccessories,
  getUserAccessoires,
  getLicences,
} from "@/lib/data";

export const metadata = {
  title: "Asset Tracker - User Details",
  description: "Asset management tool",
};

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const user = await getUserById(params.id);
  const [
    allAssets,
    links,
    statuses,
    allAccessoriesRaw,
    userAccLinks,
    licencesRaw,
    checkoutHistory,
  ] = await Promise.all([
    getAssets(),
    getUserAssets(),
    getStatus(),
    getAccessories(),
    getUserAccessoires(),
    getLicences(),
    prisma.assetCheckout.findMany({
      where: {
        OR: [{ checkedOutTo: params.id }, { checkedOutBy: params.id }],
      },
      include: {
        asset: { select: { assetid: true, assetname: true, assettag: true } },
        checkedOutByUser: {
          select: { userid: true, firstname: true, lastname: true },
        },
      },
      orderBy: { checkoutDate: "desc" },
      take: 20,
    }),
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
  const myLicences = licences.filter(
    (lic) => lic.licenceduserid === user.userid,
  );

  // Fetch history for this user from audit_logs
  const historyEntries = await prisma.audit_logs.findMany({
    where: {
      OR: [{ entity: "user", entityId: params.id }, { userId: params.id }],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
        },
      },
    },
  });

  const statusById = new Map<string, string>(
    statuses.map((s) => [s.statustypeid, s.statustypename]),
  );
  const statusColor = (name: string | undefined) => {
    const n = (name || "").toLowerCase();
    if (n === "active") return "bg-primary/10 text-primary";
    if (n === "available") return "bg-success-100 text-success-700";
    if (n === "pending") return "bg-warning-100 text-warning-700";
    if (n.includes("lost") || n.includes("stolen"))
      return "bg-danger-100 text-danger-700";
    return "bg-default-100 text-default-700";
  };

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Users", href: "/user" },
    {
      label: `${user.firstname} ${user.lastname}`,
      href: `/user/${user.userid}`,
    },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />

      <div className="flex h-full w-full flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {user.firstname} {user.lastname}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              {user.email || "No email"}
              {user.username ? ` • @${user.username}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user.isadmin ? (
              <span className="bg-foreground-200/60 text-foreground inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                Admin
              </span>
            ) : null}
            {user.canrequest ? (
              <span className="bg-primary/10 text-primary inline-flex items-center rounded-full px-2 py-1 text-xs font-medium">
                Can Request
              </span>
            ) : null}
            <Link
              href={`/user/${user.userid}/settings`}
              className="border-default-200 hover:bg-muted rounded-md border px-3 py-1.5 text-sm font-medium"
            >
              Settings
            </Link>
            <Link
              href={`/user/${user.userid}/edit`}
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
              Profile
            </h2>
            <dl className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-500">User ID</dt>
                <dd className="font-medium">{user.userid}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">First Name</dt>
                <dd className="font-medium">{user.firstname}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Last Name</dt>
                <dd className="font-medium">{user.lastname}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Username</dt>
                <dd className="font-medium">{user.username || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Language</dt>
                <dd className="font-medium">{user.lan || "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Created</dt>
                <dd className="font-medium">
                  {user.creation_date
                    ? new Date(user.creation_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-foreground-500">Updated</dt>
                <dd className="font-medium">
                  {user.change_date
                    ? new Date(user.change_date).toLocaleString()
                    : "-"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="border-default-200 col-span-2 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-foreground-600 text-sm font-semibold">
                Assigned Assets
              </h2>
              <span className="text-foreground-500 text-xs">
                {myAssets.length} total
              </span>
            </div>
            {myAssets.length === 0 ? (
              <p className="text-foreground-500 text-sm">No assets assigned.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-foreground-500">
                    <TableHead className="font-normal">Name</TableHead>
                    <TableHead className="font-normal">Tag</TableHead>
                    <TableHead className="font-normal">Serial</TableHead>
                    <TableHead className="font-normal">Status</TableHead>
                    <TableHead className="font-normal">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myAssets.map((a) => (
                    <TableRow key={a.assetid}>
                      <TableCell>
                        <Link
                          href={`/assets/${a.assetid}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {a.assetname}
                        </Link>
                      </TableCell>
                      <TableCell>{a.assettag}</TableCell>
                      <TableCell>{a.serialnumber}</TableCell>
                      <TableCell>
                        {a.statustypeid ? (
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(statusById.get(a.statustypeid))}`}
                          >
                            {statusById.get(a.statustypeid)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/assets/${a.assetid}`}
                          className="text-foreground-600 hover:underline"
                        >
                          View
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </section>
        </div>

        <section className="border-default-200 mt-6 rounded-lg border p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-foreground-600 text-sm font-semibold">
              Checkout History
            </h2>
            <span className="text-foreground-500 text-xs">
              {checkoutHistory.length} entries
            </span>
          </div>
          {checkoutHistory.length === 0 ? (
            <p className="text-foreground-500 text-sm">No checkout history.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="text-foreground-500">
                  <TableHead className="font-normal">Asset</TableHead>
                  <TableHead className="font-normal">Status</TableHead>
                  <TableHead className="font-normal">Checkout Date</TableHead>
                  <TableHead className="font-normal">Return Date</TableHead>
                  <TableHead className="font-normal">Checked Out By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checkoutHistory.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/assets/${c.asset.assetid}`}
                        className="text-primary font-medium hover:underline"
                      >
                        {c.asset.assetname}
                      </Link>
                      {c.asset.assettag ? (
                        <span className="text-foreground-500 ml-1 text-xs">
                          ({c.asset.assettag})
                        </span>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {c.status === "returned" ? (
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                          Returned
                        </Badge>
                      ) : c.status === "overdue" ||
                        (c.status === "checked_out" &&
                          c.expectedReturn &&
                          new Date(c.expectedReturn) < new Date()) ? (
                        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
                          Overdue
                        </Badge>
                      ) : c.status === "checked_out" ? (
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
                          Checked Out
                        </Badge>
                      ) : (
                        <Badge variant="outline">{c.status}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(c.checkoutDate).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {c.returnDate
                        ? new Date(c.returnDate).toLocaleDateString()
                        : "\u2014"}
                    </TableCell>
                    <TableCell>
                      {c.checkedOutByUser.firstname}{" "}
                      {c.checkedOutByUser.lastname}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <UserResources
          user={user}
          accessories={myAccessories}
          licences={myLicences}
          allAccessories={allAccessories}
          allLicences={licences}
        />

        <Separator className="my-6" />

        <section className="border-default-200 rounded-lg border p-4">
          <h2 className="text-foreground-600 mb-4 text-sm font-semibold">
            User History
          </h2>
          <HistoryTimeline entries={historyEntries} entityType="user" />
        </section>
      </div>
    </>
  );
}
