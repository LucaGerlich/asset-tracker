import { notFound } from "next/navigation";
import { getAuditCampaignById } from "@/lib/data";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import AuditCampaignActions from "./ui/AuditCampaignActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
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
  const scannedPercent = total > 0 ? Math.round(((total - unscanned) / total) * 100) : 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{campaign.name}</h1>
          {campaign.description && (
            <p className="text-muted-foreground mt-1">{campaign.description}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
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
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${scannedPercent}%` }}
            />
          </div>
          <div className="flex gap-6 text-sm text-muted-foreground">
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
        <h2 className="text-lg font-semibold mb-3">Audit Entries ({total})</h2>
        {total === 0 ? (
          <p className="text-muted-foreground">
            {campaign.status === "draft"
              ? "Activate the campaign to populate entries."
              : "No entries found."}
          </p>
        ) : (
          <div className="rounded-md border max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium">Asset</th>
                  <th className="px-4 py-3 text-left font-medium">Tag</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium">Audited By</th>
                  <th className="px-4 py-3 text-left font-medium">Date</th>
                  <th className="px-4 py-3 text-left font-medium">Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <tr key={entry.id} className="border-b">
                    <td className="px-4 py-3">{entry.asset?.assetname || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {entry.asset?.assettag || "—"}
                    </td>
                    <td className="px-4 py-3">
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
                    </td>
                    <td className="px-4 py-3">
                      {entry.auditor
                        ? `${entry.auditor.firstname} ${entry.auditor.lastname}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      {entry.auditedAt
                        ? new Date(entry.auditedAt).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">
                      {entry.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
