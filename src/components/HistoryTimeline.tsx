"use client";

import React from "react";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  Edit,
  Plus,
  Trash2,
  History,
  ArrowRightLeft,
  Undo2,
  User,
  Clock,
} from "lucide-react";

export interface HistoryEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: Date | string;
  user: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
  } | null;
}

interface HistoryTimelineProps {
  entries: HistoryEntry[];
  entityType: string;
}

function getActionIcon(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
      return <Plus className="h-4 w-4" />;
    case "UPDATE":
      return <Edit className="h-4 w-4" />;
    case "DELETE":
      return <Trash2 className="h-4 w-4" />;
    case "ASSIGN":
      return <UserPlus className="h-4 w-4" />;
    case "UNASSIGN":
      return <UserMinus className="h-4 w-4" />;
    case "REVERT":
      return <Undo2 className="h-4 w-4" />;
    case "LOGIN":
    case "LOGOUT":
      return <ArrowRightLeft className="h-4 w-4" />;
    default:
      return <History className="h-4 w-4" />;
  }
}

function getActionColor(action: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
      return "bg-green-100 text-green-600 border-green-200";
    case "UPDATE":
      return "bg-blue-100 text-blue-600 border-blue-200";
    case "DELETE":
      return "bg-red-100 text-red-600 border-red-200";
    case "ASSIGN":
      return "bg-purple-100 text-purple-600 border-purple-200";
    case "UNASSIGN":
      return "bg-orange-100 text-orange-600 border-orange-200";
    case "REVERT":
      return "bg-amber-100 text-amber-600 border-amber-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function formatAction(action: string, entity: string) {
  switch (action.toUpperCase()) {
    case "CREATE":
      return `${entity} created`;
    case "UPDATE":
      return `${entity} updated`;
    case "DELETE":
      return `${entity} deleted`;
    case "ASSIGN":
      return `Assigned to user`;
    case "UNASSIGN":
      return `Unassigned from user`;
    case "REVERT":
      return `Change reverted`;
    case "LOGIN":
      return "User logged in";
    case "LOGOUT":
      return "User logged out";
    default:
      return `${action} - ${entity}`;
  }
}

/** Fields that clutter the diff and should be hidden */
const HIDDEN_FIELDS = new Set([
  "creation_date",
  "createdAt",
  "updatedAt",
  "change_date",
  "organizationId",
  "before",
  "after",
  "changes",
]);

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/id$/i, "")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase());
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

interface ParsedDetails {
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changes?: Record<string, { from: unknown; to: unknown }>;
  [key: string]: unknown;
}

function parseDetails(details: string | null): ParsedDetails | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

/** Render field-level changes (before → after) */
function ChangesDisplay({ details }: { details: ParsedDetails }) {
  // Snapshot-style audit log with changes object
  if (details.changes && typeof details.changes === "object") {
    const changeEntries = Object.entries(
      details.changes as Record<string, { from: unknown; to: unknown }>,
    ).filter(([key]) => !HIDDEN_FIELDS.has(key));

    if (changeEntries.length === 0) return null;

    return (
      <div className="mt-3 space-y-2 border-t pt-3">
        <p className="text-muted-foreground mb-2 text-xs font-medium tracking-wide uppercase">
          Changes
        </p>
        {changeEntries.map(([field, change]) => (
          <div key={field} className="flex flex-col gap-0.5 text-sm">
            <span className="text-muted-foreground text-xs font-medium">
              {formatFieldName(field)}
            </span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-red-50 px-1.5 py-0.5 font-mono text-xs text-red-700 line-through">
                {formatValue(change.from)}
              </span>
              <span className="text-muted-foreground text-xs">&rarr;</span>
              <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-xs text-green-700">
                {formatValue(change.to)}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Flat details (older audit logs without snapshot)
  const flatEntries = Object.entries(details).filter(
    ([key]) => !HIDDEN_FIELDS.has(key),
  );
  if (flatEntries.length === 0) return null;

  return (
    <div className="mt-3 border-t pt-3">
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {flatEntries.map(([key, value]) => (
          <div key={key} className="flex gap-2">
            <dt className="text-muted-foreground capitalize">
              {formatFieldName(key)}:
            </dt>
            <dd className="font-medium">{formatValue(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * Compact "Last edited by" badge — rendered above the timeline.
 * Shows the most recent UPDATE entry's author and date.
 */
function LastEditedSummary({ entries }: { entries: HistoryEntry[] }) {
  // Find the most recent UPDATE (or REVERT) entry
  const lastEdit = entries.find((e) =>
    ["UPDATE", "REVERT"].includes(e.action.toUpperCase()),
  );
  // Find the CREATE entry (earliest, so last in desc-sorted list)
  const createEntry = [...entries]
    .reverse()
    .find((e) => e.action.toUpperCase() === "CREATE");

  if (!lastEdit && !createEntry) return null;

  return (
    <div className="mb-4 flex flex-wrap gap-4 text-sm">
      {createEntry?.user && (
        <div className="flex items-center gap-2 rounded-md border bg-green-50/50 px-3 py-1.5">
          <User className="h-3.5 w-3.5 text-green-600" />
          <span className="text-muted-foreground">Created by</span>
          <Link
            href={`/user/${createEntry.user.userid}`}
            className="text-primary font-medium hover:underline"
          >
            {createEntry.user.firstname} {createEntry.user.lastname}
          </Link>
          <span className="text-muted-foreground">&bull;</span>
          <time className="text-muted-foreground">
            {new Date(createEntry.createdAt).toLocaleDateString()}
          </time>
        </div>
      )}
      {lastEdit?.user && (
        <div className="flex items-center gap-2 rounded-md border bg-blue-50/50 px-3 py-1.5">
          <Clock className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-muted-foreground">Last edited by</span>
          <Link
            href={`/user/${lastEdit.user.userid}`}
            className="text-primary font-medium hover:underline"
          >
            {lastEdit.user.firstname} {lastEdit.user.lastname}
          </Link>
          <span className="text-muted-foreground">&bull;</span>
          <time className="text-muted-foreground">
            {new Date(lastEdit.createdAt).toLocaleString()}
          </time>
        </div>
      )}
    </div>
  );
}

export default function HistoryTimeline({
  entries,
  entityType,
}: HistoryTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center">
        <History className="text-muted-foreground mx-auto mb-3 h-12 w-12" />
        <p className="text-muted-foreground">No history available yet</p>
        <p className="text-muted-foreground text-sm">
          Changes to this {entityType} will appear here
        </p>
      </div>
    );
  }

  return (
    <div>
      <LastEditedSummary entries={entries} />

      <div className="relative">
        {/* Timeline line */}
        <div className="bg-border absolute top-0 bottom-0 left-4 w-0.5" />

        <div className="space-y-6">
          {entries.map((entry) => {
            const details = parseDetails(entry.details);

            return (
              <div key={entry.id} className="relative pl-10">
                {/* Timeline dot */}
                <div
                  className={`absolute left-2 flex h-5 w-5 items-center justify-center rounded-full border-2 ${getActionColor(
                    entry.action,
                  )}`}
                >
                  {getActionIcon(entry.action)}
                </div>

                {/* Content */}
                <div className="bg-card rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium">
                        {formatAction(entry.action, entry.entity)}
                      </p>
                      {entry.user && (
                        <p className="text-muted-foreground mt-1 text-sm">
                          by{" "}
                          <Link
                            href={`/user/${entry.user.userid}`}
                            className="text-primary hover:underline"
                          >
                            {entry.user.firstname} {entry.user.lastname}
                          </Link>
                        </p>
                      )}
                    </div>
                    <time className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(entry.createdAt).toLocaleString()}
                    </time>
                  </div>

                  {/* Field-level changes */}
                  {details && <ChangesDisplay details={details} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
