"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ComplianceData {
  accessControl: {
    totalUsers: number;
    adminUsers: number;
    regularUsers: number;
  };
  auditCoverage: {
    totalEntities: number;
    auditedEntities: number;
    coveragePercent: number;
    totalAuditLogs: number;
    lastActivityDate: string | null;
  };
  dataRetention: {
    gdprConfigured: boolean;
    auditLogRetentionDays: number;
    deletedUserRetentionDays: number;
    exportRetentionDays: number;
    lastUpdated: string | null;
  };
  assetInventory: {
    totalAssets: number;
    activeAssets: number;
    retiredAssets: number;
    otherAssets: number;
  };
}

type ComplianceStatus =
  | "Compliant"
  | "Needs Review"
  | "Not Configured"
  | "Not Yet Available";

interface ComplianceCheckItem {
  id: string;
  label: string;
  description: string;
  framework: string;
  getStatus: (data: ComplianceData) => ComplianceStatus;
}

const complianceChecklist: ComplianceCheckItem[] = [
  {
    id: "access-control-review",
    label: "Access Control Review",
    description:
      "Admin user accounts are documented and access privileges are reviewed.",
    framework: "SOX",
    getStatus: (data) => {
      if (data.accessControl.totalUsers === 0) return "Not Configured";
      // Flag if admin ratio is too high (> 50%) as "Needs Review"
      const adminRatio =
        data.accessControl.adminUsers / data.accessControl.totalUsers;
      return adminRatio <= 0.5 ? "Compliant" : "Needs Review";
    },
  },
  {
    id: "audit-trail",
    label: "Audit Trail Coverage",
    description:
      "All entity changes are tracked through the audit logging system.",
    framework: "SOX",
    getStatus: (data) => {
      if (data.auditCoverage.totalAuditLogs === 0) return "Not Configured";
      return data.auditCoverage.coveragePercent >= 50
        ? "Compliant"
        : "Needs Review";
    },
  },
  {
    id: "data-retention-policy",
    label: "Data Retention Policy",
    description:
      "GDPR retention settings are configured and actively enforced.",
    framework: "HIPAA",
    getStatus: (data) => {
      if (!data.dataRetention.gdprConfigured) return "Not Configured";
      return "Compliant";
    },
  },
  {
    id: "asset-inventory",
    label: "Asset Inventory Management",
    description:
      "A complete inventory of IT assets is maintained with lifecycle tracking.",
    framework: "SOX",
    getStatus: (data) => {
      if (data.assetInventory.totalAssets === 0) return "Not Configured";
      return "Compliant";
    },
  },
  {
    id: "user-authentication",
    label: "User Authentication Controls",
    description:
      "Multi-factor authentication is not yet implemented. Coming in a future update.",
    framework: "HIPAA",
    getStatus: () => {
      return "Not Yet Available";
    },
  },
  {
    id: "data-encryption",
    label: "Data Encryption at Rest",
    description:
      "Encryption coverage is not yet implemented. Coming in a future update.",
    framework: "HIPAA",
    getStatus: () => {
      return "Not Yet Available";
    },
  },
  {
    id: "incident-response",
    label: "Incident Response Plan",
    description:
      "A documented incident response plan is in place for security breaches.",
    framework: "HIPAA",
    getStatus: () => {
      return "Not Configured";
    },
  },
  {
    id: "change-management",
    label: "Change Management Process",
    description:
      "All system changes are documented and approved through a formal process.",
    framework: "SOX",
    getStatus: (data) => {
      if (data.auditCoverage.totalAuditLogs === 0) return "Not Configured";
      return data.auditCoverage.lastActivityDate ? "Compliant" : "Needs Review";
    },
  },
];

function statusBadgeVariant(
  status: ComplianceStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "Compliant":
      return "default";
    case "Needs Review":
      return "secondary";
    case "Not Configured":
      return "destructive";
    case "Not Yet Available":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ComplianceDashboard() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    async function fetchCompliance() {
      try {
        const res = await fetch("/api/admin/compliance");
        if (!res.ok) throw new Error("Failed to fetch compliance data");
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error("Failed to load compliance data", err);
        toast.error("Failed to load compliance data");
      } finally {
        setLoading(false);
      }
    }
    fetchCompliance();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch("/api/admin/compliance/export");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Export failed");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = res.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      a.download = filenameMatch?.[1] ?? "compliance-report.json";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();

      toast.success("Compliance report downloaded successfully");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate report",
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Compliance Reporting</h1>
          <p className="text-muted-foreground">Loading compliance data...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="py-8">
                <div className="bg-muted mb-2 h-4 w-3/4 animate-pulse rounded" />
                <div className="bg-muted h-8 w-1/2 animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Compliance Reporting</h1>
        <Card>
          <CardContent className="py-8">
            <p className="text-muted-foreground text-center">
              Failed to load compliance data. Please try again later.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Compliance Reporting</h1>
          <p className="text-muted-foreground">
            SOX and HIPAA compliance overview with audit trail and access
            control metrics.
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? "Generating..." : "Generate Report"}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Access Control Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Access Control
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.accessControl.totalUsers}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {data.accessControl.adminUsers} admin{" "}
              {data.accessControl.adminUsers === 1 ? "user" : "users"} /{" "}
              {data.accessControl.regularUsers} regular
            </p>
          </CardContent>
        </Card>

        {/* Audit Coverage Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Audit Coverage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.auditCoverage.coveragePercent}%
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {data.auditCoverage.auditedEntities} of{" "}
              {data.auditCoverage.totalEntities} entities audited (90d)
            </p>
          </CardContent>
        </Card>

        {/* Data Retention Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Data Retention
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.dataRetention.gdprConfigured ? (
                <Badge variant="default">Configured</Badge>
              ) : (
                <Badge variant="destructive">Not Configured</Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {data.dataRetention.gdprConfigured
                ? `Audit logs: ${data.dataRetention.auditLogRetentionDays}d`
                : "GDPR settings need to be configured"}
            </p>
          </CardContent>
        </Card>

        {/* Asset Inventory Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Asset Inventory
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.assetInventory.totalAssets}
            </div>
            <p className="text-muted-foreground mt-1 text-xs">
              {data.assetInventory.activeAssets} active /{" "}
              {data.assetInventory.retiredAssets} retired
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Access Control Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Access Control Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">Total Users</span>
              <span className="text-sm font-medium">
                {data.accessControl.totalUsers}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">Admin Users</span>
              <span className="text-sm font-medium">
                {data.accessControl.adminUsers}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Regular Users
              </span>
              <span className="text-sm font-medium">
                {data.accessControl.regularUsers}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground text-sm">Admin Ratio</span>
              <span className="text-sm font-medium">
                {data.accessControl.totalUsers > 0
                  ? Math.round(
                      (data.accessControl.adminUsers /
                        data.accessControl.totalUsers) *
                        100,
                    )
                  : 0}
                %
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Audit Coverage Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Audit Trail Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Total Audit Entries
              </span>
              <span className="text-sm font-medium">
                {data.auditCoverage.totalAuditLogs.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Entities with Recent Activity
              </span>
              <span className="text-sm font-medium">
                {data.auditCoverage.auditedEntities} /{" "}
                {data.auditCoverage.totalEntities}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Coverage (90 days)
              </span>
              <span className="text-sm font-medium">
                {data.auditCoverage.coveragePercent}%
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground text-sm">
                Last Activity
              </span>
              <span className="text-sm font-medium">
                {formatDate(data.auditCoverage.lastActivityDate)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Data Retention Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Data Retention Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                GDPR Configured
              </span>
              <Badge
                variant={
                  data.dataRetention.gdprConfigured ? "default" : "destructive"
                }
              >
                {data.dataRetention.gdprConfigured ? "Yes" : "No"}
              </Badge>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Audit Log Retention
              </span>
              <span className="text-sm font-medium">
                {data.dataRetention.auditLogRetentionDays} days
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Deleted User Retention
              </span>
              <span className="text-sm font-medium">
                {data.dataRetention.deletedUserRetentionDays} days
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Export Retention
              </span>
              <span className="text-sm font-medium">
                {data.dataRetention.exportRetentionDays} days
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground text-sm">
                Last Updated
              </span>
              <span className="text-sm font-medium">
                {formatDate(data.dataRetention.lastUpdated)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Asset Inventory Detail */}
        <Card>
          <CardHeader>
            <CardTitle>Asset Inventory Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Total Assets
              </span>
              <span className="text-sm font-medium">
                {data.assetInventory.totalAssets}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Active Assets
              </span>
              <span className="text-sm font-medium">
                {data.assetInventory.activeAssets}
              </span>
            </div>
            <div className="flex items-center justify-between border-b py-2">
              <span className="text-muted-foreground text-sm">
                Retired Assets
              </span>
              <span className="text-sm font-medium">
                {data.assetInventory.retiredAssets}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-muted-foreground text-sm">
                Other Status
              </span>
              <span className="text-sm font-medium">
                {data.assetInventory.otherAssets}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Checklist */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Checklist</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4 text-sm">
            Review each compliance requirement below. Items are evaluated
            against current system configuration and data.
          </p>
          <div className="divide-y">
            {complianceChecklist.map((item) => {
              const status = item.getStatus(data);
              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between py-3"
                >
                  <div className="mr-4 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.label}</span>
                      <Badge variant="outline" className="text-xs">
                        {item.framework}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {item.description}
                    </p>
                  </div>
                  <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
