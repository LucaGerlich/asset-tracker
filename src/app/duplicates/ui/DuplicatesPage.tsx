"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, AlertTriangle, ExternalLink } from "lucide-react";

interface DuplicateAsset {
  assetId: string;
  assetName: string;
  assetTag: string;
  serialNumber: string;
}

interface DuplicateGroup {
  reason: string;
  confidence: string;
  assets: DuplicateAsset[];
}

type ConfidenceFilter = "all" | "high" | "medium" | "low";

const REASON_LABELS: Record<string, string> = {
  same_model_location: "Same Model & Location",
  similar_serial: "Similar Serial Number",
  similar_name: "Similar Name",
};

const CONFIDENCE_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-800",
  medium: "bg-yellow-100 text-yellow-800",
  low: "bg-blue-100 text-blue-800",
};

const CONFIDENCE_DESCRIPTIONS: Record<string, string> = {
  high: "Very likely duplicates — same model at the same location",
  medium: "Possible duplicates — serial numbers differ by 1-2 characters",
  low: "Worth checking — asset names are very similar",
};

export default function DuplicatesPage() {
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [totalGroups, setTotalGroups] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ConfidenceFilter>("all");

  useEffect(() => {
    fetch("/api/dashboard/duplicates?all=true")
      .then((r) => r.json())
      .then((data) => {
        setGroups(data.groups ?? []);
        setTotalGroups(data.totalGroups ?? 0);
      })
      .catch(() => {
        setGroups([]);
        setTotalGroups(0);
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredGroups = useMemo(
    () =>
      filter === "all" ? groups : groups.filter((g) => g.confidence === filter),
    [groups, filter],
  );

  const counts = useMemo(() => {
    const c = { high: 0, medium: 0, low: 0 };
    for (const g of groups) {
      if (g.confidence in c) c[g.confidence as keyof typeof c]++;
    }
    return c;
  }, [groups]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-3 text-sm">
          Scanning for duplicate assets...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Duplicate Detection</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Potential duplicate assets identified by serial number similarity,
          name similarity, and matching model + location combinations.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-muted-foreground text-xs">Total Groups</p>
            <p className="text-2xl font-bold">{totalGroups}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-red-600">High Confidence</p>
            <p className="text-2xl font-bold">{counts.high}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-yellow-600">Medium Confidence</p>
            <p className="text-2xl font-bold">{counts.medium}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-blue-600">Low Confidence</p>
            <p className="text-2xl font-bold">{counts.low}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {(
          [
            { value: "all", label: `All (${totalGroups})` },
            { value: "high", label: `High (${counts.high})` },
            { value: "medium", label: `Medium (${counts.medium})` },
            { value: "low", label: `Low (${counts.low})` },
          ] as const
        ).map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      {/* Groups */}
      {filteredGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <Copy className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground mt-3 text-sm">
            {totalGroups === 0
              ? "No potential duplicates found. Your asset data looks clean."
              : "No groups match the selected filter."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group, idx) => (
            <Card key={idx}>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    className={`h-4 w-4 shrink-0 ${
                      group.confidence === "high"
                        ? "text-red-500"
                        : group.confidence === "medium"
                          ? "text-yellow-500"
                          : "text-blue-500"
                    }`}
                  />
                  <CardTitle className="text-sm">
                    {REASON_LABELS[group.reason] ?? group.reason}
                  </CardTitle>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${CONFIDENCE_COLORS[group.confidence] ?? ""}`}
                  >
                    {group.confidence}
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  {CONFIDENCE_DESCRIPTIONS[group.confidence] ?? ""}
                  {" — "}
                  {group.assets.length} assets in this group
                </p>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="pb-2 font-medium">Asset Name</th>
                        <th className="pb-2 font-medium">Asset Tag</th>
                        <th className="pb-2 font-medium">Serial Number</th>
                        <th className="pb-2 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.assets.map((asset) => (
                        <tr
                          key={asset.assetId}
                          className="border-b last:border-0"
                        >
                          <td className="py-2 font-medium">
                            {asset.assetName}
                          </td>
                          <td className="text-muted-foreground py-2">
                            {asset.assetTag}
                          </td>
                          <td className="text-muted-foreground py-2 font-mono text-xs">
                            {asset.serialNumber}
                          </td>
                          <td className="py-2 text-right">
                            <Link
                              href={`/assets/${asset.assetId}`}
                              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
