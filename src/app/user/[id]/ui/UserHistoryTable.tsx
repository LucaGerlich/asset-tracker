import React from "react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserHistoryEntry {
  historyid: string;
  referenceid: string | null;
  referencetable: string | null;
  userid: string;
  actionname: string;
  updatedate: Date | null;
  checkedout: Date | null;
  checkedin: Date | null;
  creation_date: Date;
  change_date: Date | null;
}

interface UserHistoryTableProps {
  entries: UserHistoryEntry[];
  assets: Array<{ assetid: string; assetname: string; assettag: string | null }>;
  accessories: Array<{ accessorieid: string; accessoriename: string; accessorietag: string | null }>;
  licences: Array<{ licenceid: string; licencekey: string | null }>;
}

function formatDateTime(date: Date | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleString();
}

function formatDate(date: Date | null | undefined) {
  if (!date) return "-";
  return new Date(date).toLocaleDateString();
}

function getEventDate(entry: UserHistoryEntry) {
  const action = entry.actionname?.toLowerCase() || "";
  if (action.includes("checked out") && entry.checkedout) return entry.checkedout;
  if (action.includes("checked in") && entry.checkedin) return entry.checkedin;
  return entry.updatedate ?? entry.creation_date;
}

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function UserHistoryTable({
  entries,
  assets,
  accessories,
  licences,
}: UserHistoryTableProps) {
  const assetById = new Map(assets.map((asset) => [asset.assetid, asset]));
  const accessoryById = new Map(
    accessories.map((accessory) => [accessory.accessorieid, accessory])
  );
  const licenceById = new Map(licences.map((licence) => [licence.licenceid, licence]));

  const resolveReference = (entry: UserHistoryEntry) => {
    const referenceId = entry.referenceid;
    if (!referenceId) {
      return { label: "-", href: null, type: entry.referencetable || "Reference" };
    }

    const table = (entry.referencetable || "").toLowerCase();
    const shortId = referenceId.slice(0, 8);

    if (table === "asset") {
      const asset = assetById.get(referenceId);
      return {
        label: asset
          ? `${asset.assetname}${asset.assettag ? ` - ${asset.assettag}` : ""}`
          : `Asset ${shortId}`,
        href: `/assets/${referenceId}`,
        type: "Asset",
      };
    }

    if (table === "accessory" || table === "accessories") {
      const accessory = accessoryById.get(referenceId);
      return {
        label: accessory
          ? `${accessory.accessoriename}${accessory.accessorietag ? ` - ${accessory.accessorietag}` : ""}`
          : `Accessory ${shortId}`,
        href: `/accessories/${referenceId}`,
        type: "Accessory",
      };
    }

    if (table === "licence" || table === "license" || table === "licenses" || table === "licences") {
      const licence = licenceById.get(referenceId);
      return {
        label: licence?.licencekey || `Licence ${shortId}`,
        href: `/licences/${referenceId}`,
        type: "Licence",
      };
    }

    if (table === "consumable" || table === "consumables") {
      return {
        label: `Consumable ${shortId}`,
        href: `/consumables/${referenceId}`,
        type: "Consumable",
      };
    }

    return {
      label: referenceId,
      href: null,
      type: entry.referencetable ? toTitleCase(entry.referencetable) : "Reference",
    };
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Action</TableHead>
          <TableHead>Reference</TableHead>
          <TableHead>Event Date</TableHead>
          <TableHead>Checked Out</TableHead>
          <TableHead>Checked In</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="text-center text-muted-foreground">
              No history entries recorded yet.
            </TableCell>
          </TableRow>
        ) : (
          entries.map((entry) => {
            const reference = resolveReference(entry);
            const eventDate = getEventDate(entry);

            return (
              <TableRow key={entry.historyid}>
                <TableCell className="font-medium">{entry.actionname}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    {reference.href ? (
                      <Link href={reference.href} className="text-primary hover:underline">
                        {reference.label}
                      </Link>
                    ) : (
                      <span>{reference.label}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {reference.type}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{formatDateTime(eventDate)}</TableCell>
                <TableCell>{formatDate(entry.checkedout)}</TableCell>
                <TableCell>{formatDate(entry.checkedin)}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}
