import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import { getAuditCampaigns } from "@/lib/data";
import { Button } from "@/components/ui/button";
import AuditCampaignsTable from "./ui/AuditCampaignsTable";

export const metadata = {
  title: "Asset Tracker - Audits",
  description: "Asset management tool",
};

export default async function AuditsPage() {
  const campaigns = await getAuditCampaigns();

  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Audits", href: "/audits" },
        ]}
      />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Audit Campaigns</h1>
        <Button asChild>
          <Link href="/audits/create">Create Campaign</Link>
        </Button>
      </div>
      <AuditCampaignsTable campaigns={campaigns} />
    </div>
  );
}
