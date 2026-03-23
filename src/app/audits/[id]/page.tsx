import { notFound } from "next/navigation";
import { getAuditCampaignById } from "@/lib/data";
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
import AuditCampaignActions from "./ui/AuditCampaignActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusVariant: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "secondary",
  active: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default async function AuditCampaignDetailPage({ params }: PageProps) {
  const { id } = await params;

  let campaign;
  try {
    campaign = await getAuditCampaignById(id);
  } catch {
    notFound();
  }

  const entries = campaign.entries || [];
  const total = entries.length;
  const found = entries.filter((e: any) => e.status === "found").length;
  const missing = entries.filter((e: any) => e.status === "missing").length;
  const moved = entries.filter((e: any) => e.status === "moved").length;
  const unscanned = entries.filter((e: any) => e.status === "unscanned").length;
  const scannedPercent =
    total > 0 ? Math.round(((total - unscanned) / total) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-muted-foreground mt-1">{campaign.description}</p>
          )}
          <p className="text-muted-foreground mt-1 text-sm">
            Created by {campaign.creator.firstname} {campaign.creator.lastname}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={statusVariant[campaign.status] || "secondary"}>
            {campaign.status}
          </Badge>
          <AuditCampaignActions campaignId={id} status={campaign.status} />
        </div>
      </div>

      <Separator />

      {/* Progress */}
      {total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Audit Progress</span>
            <span>{scannedPercent}% scanned</span>
          </div>
          <div className="bg-muted h-3 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all"
              style={{ width: `${scannedPercent}%` }}
            />
          </div>
          <div className="text-muted-foreground flex gap-6 text-sm">
            <span className="text-green-600">Found: {found}</span>
            <span className="text-red-600">Missing: {missing}</span>
            <span className="text-yellow-600">Moved: {moved}</span>
            <span>Unscanned: {unscanned}</span>
            <span>Total: {total}</span>
          </div>
        </div>
      )}

      <Separator />

      {/* Entries table */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">Audit Entries ({total})</h2>
        {total === 0 ? (
          <p className="text-muted-foreground">
            {campaign.status === "draft"
              ? "Activate the campaign to populate entries."
              : "No entries found."}
          </p>
        ) : (
          <div className="max-h-[600px] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader className="bg-background sticky top-0">
                <TableRow className="bg-muted/50">
                  <TableHead>Asset</TableHead>
                  <TableHead>Tag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audited By</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any) => (
                  <TableRow key={entry.id}>
                    <TableCell>{entry.asset?.assetname || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.asset?.assettag || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          entry.status === "found"
                            ? "default"
                            : entry.status === "missing"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {entry.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {entry.auditor
                        ? `${entry.auditor.firstname} ${entry.auditor.lastname}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {entry.auditedAt
                        ? new Date(entry.auditedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
