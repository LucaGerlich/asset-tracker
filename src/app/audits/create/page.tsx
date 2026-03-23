import AuditCampaignForm from "./ui/AuditCampaignForm";
import Breadcrumb from "@/components/Breadcrumb";

export const metadata = {
  title: "Asset Tracker - Create Audit",
};

export default function CreateAuditPage() {
  return (
    <div className="space-y-6 p-6">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Audits", href: "/audits" },
          { label: "Create Audit" },
        ]}
      />
      <h1 className="text-2xl font-bold">Create Audit Campaign</h1>
      <AuditCampaignForm />
    </div>
  );
}
