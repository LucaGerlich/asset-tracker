"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import AssetDetailActions from "./AssetDetailActions";

function StatusChip({ name }) {
  const cls = useMemo(() => {
    const n = (name || "").toLowerCase();
    if (n === "active") return "bg-primary/10 text-primary";
    if (n === "available") return "bg-success-100 text-success-700";
    if (n === "pending") return "bg-warning-100 text-warning-700";
    if (n.includes("lost") || n.includes("stolen")) return "bg-danger-100 text-danger-700";
    return "bg-default-100 text-default-700";
  }, [name]);
  if (!name) return null;
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}>{name}</span>;
}

export default function AssetDetailHeader({ asset, statuses, users, userAssets }) {
  const [statusId, setStatusId] = useState(asset.statustypeid || null);
  const statusName = useMemo(() => statuses.find((s) => s.statustypeid === statusId)?.statustypename, [statuses, statusId]);
  const active = useMemo(() => statuses.find((s) => s.statustypename?.toLowerCase() === "active"), [statuses]);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{asset.assetname}</h1>
        <p className="text-sm text-foreground-500 mt-1">Asset Tag {asset.assettag} • Serial {asset.serialnumber}</p>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip name={statusName} />
        <Link href={`/assets/${asset.assetid}/edit`} className="rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90">
          Edit
        </Link>
        <AssetDetailActions asset={asset} users={users} userAssets={userAssets} onAssigned={() => active && setStatusId(active.statustypeid)} />
      </div>
    </div>
  );
}

