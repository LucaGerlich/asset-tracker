"use client";

import React from "react";
import Link from "next/link";
import {
  UserPlus,
  UserMinus,
  Edit,
  Plus,
  Trash2,
  Settings,
  History,
  ArrowRightLeft,
} from "lucide-react";

interface HistoryEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  createdAt: Date;
  user: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
  } | null;
}

interface HistoryTimelineProps {
  entries: HistoryEntry[];
  entityType: "asset" | "user";
}

function normalizeAction(action: string) {
  return action.trim().toUpperCase();
}

function getActionIcon(action: string) {
  switch (normalizeAction(action)) {
    case "CREATE":
    case "CREATED":
      return <Plus className="h-4 w-4" />;
    case "UPDATE":
    case "UPDATED":
      return <Edit className="h-4 w-4" />;
    case "DELETE":
    case "DELETED":
      return <Trash2 className="h-4 w-4" />;
    case "ASSIGN":
    case "ASSIGNED":
    case "CHECKED OUT":
      return <UserPlus className="h-4 w-4" />;
    case "UNASSIGN":
    case "UNASSIGNED":
    case "CHECKED IN":
      return <UserMinus className="h-4 w-4" />;
    case "LOGIN":
    case "LOGOUT":
      return <ArrowRightLeft className="h-4 w-4" />;
    default:
      return <History className="h-4 w-4" />;
  }
}

function getActionColor(action: string) {
  switch (normalizeAction(action)) {
    case "CREATE":
    case "CREATED":
      return "bg-green-100 text-green-600 border-green-200";
    case "UPDATE":
    case "UPDATED":
      return "bg-blue-100 text-blue-600 border-blue-200";
    case "DELETE":
    case "DELETED":
      return "bg-red-100 text-red-600 border-red-200";
    case "ASSIGN":
    case "ASSIGNED":
    case "CHECKED OUT":
      return "bg-purple-100 text-purple-600 border-purple-200";
    case "UNASSIGN":
    case "UNASSIGNED":
    case "CHECKED IN":
      return "bg-orange-100 text-orange-600 border-orange-200";
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

function formatAction(action: string, entity: string, entityType: HistoryTimelineProps["entityType"]) {
  switch (normalizeAction(action)) {
    case "CREATE":
    case "CREATED":
      return `${entity} created`;
    case "UPDATE":
    case "UPDATED":
      return `${entity} updated`;
    case "DELETE":
    case "DELETED":
      return `${entity} deleted`;
    case "ASSIGN":
    case "ASSIGNED":
      return entityType === "user" ? "Asset assigned" : "Assigned to user";
    case "UNASSIGN":
    case "UNASSIGNED":
      return entityType === "user" ? "Asset unassigned" : "Unassigned from user";
    case "CHECKED OUT":
      return "Checked out";
    case "CHECKED IN":
      return "Checked in";
    case "LOGIN":
      return "User logged in";
    case "LOGOUT":
      return "User logged out";
    default:
      return `${action} - ${entity}`;
  }
}

function parseDetails(details: string | null): Record<string, unknown> | null {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

export default function HistoryTimeline({ entries, entityType }: HistoryTimelineProps) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No history available yet</p>
        <p className="text-sm text-muted-foreground">
          Changes to this {entityType} will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

      <div className="space-y-6">
        {entries.map((entry, index) => {
          const details = parseDetails(entry.details);

          return (
            <div key={entry.id} className="relative pl-10">
              {/* Timeline dot */}
              <div
                className={`absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center ${getActionColor(
                  entry.action
                )}`}
              >
                {getActionIcon(entry.action)}
              </div>

              {/* Content */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">
                      {formatAction(entry.action, entry.entity, entityType)}
                    </p>
                    {entry.user && (
                      <p className="text-sm text-muted-foreground mt-1">
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
                  <time className="text-sm text-muted-foreground whitespace-nowrap">
                    {new Date(entry.createdAt).toLocaleString()}
                  </time>
                </div>

                {/* Details */}
                {details && (
                  <div className="mt-3 pt-3 border-t">
                    <dl className="grid grid-cols-2 gap-2 text-sm">
                      {Object.entries(details).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <dt className="text-muted-foreground capitalize">
                            {key.replace(/_/g, " ")}:
                          </dt>
                          <dd className="font-medium">
                            {typeof value === "boolean"
                              ? value
                                ? "Yes"
                                : "No"
                              : String(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
