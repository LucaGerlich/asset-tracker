"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";
import AssetDetailActions from "./AssetDetailActions";
import ReportProblemButton from "@/components/ReportProblemButton";
import RequestItemDialog from "@/components/RequestItemDialog";

function StatusChip({ name }) {
  const cls = useMemo(() => {
    const n = (name || "").toLowerCase();
    if (n === "active") return "bg-primary/10 text-primary";
    if (n === "available") return "bg-success-100 text-success-700";
    if (n === "pending") return "bg-warning-100 text-warning-700";
    if (n.includes("lost") || n.includes("stolen"))
      return "bg-danger-100 text-danger-700";
    return "bg-default-100 text-default-700";
  }, [name]);
  if (!name) return null;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${cls}`}
    >
      {name}
    </span>
  );
}

export default function AssetDetailHeader({
  asset,
  statuses,
  users,
  userAssets,
  isAdmin = true,
}) {
  const [statusId, setStatusId] = useState(asset.statustypeid || null);
  const [requestOpen, setRequestOpen] = useState(false);
  const statusName = useMemo(
    () => statuses.find((s) => s.statustypeid === statusId)?.statustypename,
    [statuses, statusId],
  );
  const active = useMemo(
    () => statuses.find((s) => s.statustypename?.toLowerCase() === "active"),
    [statuses],
  );
  const isAvailable = statusName?.toLowerCase().includes("available");
  const canRequest = !isAdmin && (asset.requestable || isAvailable);

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{asset.assetname}</h1>
        <p className="text-foreground-500 mt-1 text-sm">
          Asset Tag {asset.assettag} • Serial {asset.serialnumber}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <StatusChip name={statusName} />
        <ReportProblemButton
          entityType="asset"
          entityId={asset.assetid}
          entityName={asset.assetname}
        />
        {canRequest && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setRequestOpen(true)}
          >
            <CalendarPlus className="mr-2 h-4 w-4" />
            Request
          </Button>
        )}
        <RequestItemDialog
          entityType="asset"
          entityId={asset.assetid}
          entityName={asset.assetname}
          open={requestOpen}
          onOpenChange={setRequestOpen}
        />
        {isAdmin && (
          <Link
            href={`/assets/${asset.assetid}/edit`}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium hover:opacity-90"
          >
            Edit
          </Link>
        )}
        {isAdmin && (
          <AssetDetailActions
            asset={asset}
            users={users}
            userAssets={userAssets}
            onAssigned={() => active && setStatusId(active.statustypeid)}
          />
        )}
      </div>
    </div>
  );
}
