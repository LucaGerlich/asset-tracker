import { notFound, redirect } from "next/navigation";
import { getAuditCampaignById } from "@/lib/data";
import Breadcrumb from "@/components/Breadcrumb";
import AuditScanClient from "./ui/AuditScanClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  try {
    const campaign = await getAuditCampaignById(id);
    return { title: `Scan - ${campaign.name} - Asset Tracker` };
  } catch {
    return { title: "Audit Scan - Asset Tracker" };
  }
}

export default async function AuditScanPage({ params }: PageProps) {
  const { id } = await params;

  let campaign;
  try {
    campaign = await getAuditCampaignById(id);
  } catch {
    notFound();
  }

  if (campaign.status !== "active") {
    redirect(`/audits/${id}`);
  }

  const entries = (campaign.entries || []).map((e: any) => ({
    id: e.id,
    assetId: e.assetId,
    status: e.status,
    asset: {
      assetid: e.asset?.assetid || "",
      assetname: e.asset?.assetname || "",
      assettag: e.asset?.assettag || "",
    },
  }));

  const breadcrumbOptions = [
    { label: "Home", href: "/" },
    { label: "Audits", href: "/audits" },
    { label: campaign.name, href: `/audits/${id}` },
    { label: "Scan", href: `/audits/${id}/scan` },
  ];

  return (
    <>
      <Breadcrumb options={breadcrumbOptions} />
      <div className="p-6">
        <AuditScanClient
          campaignId={id}
          campaignName={campaign.name}
          entries={entries}
        />
      </div>
    </>
  );
}
