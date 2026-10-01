import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createPageMetadata } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import { getBreadcrumbSchema } from "@/lib/structured-data";
import PricingPageClient from "./PricingPageClient";

export const metadata = createPageMetadata({
  title: "Pricing — Simple Plans for Every Team",
  description:
    "Simple, transparent pricing for IT asset management. Start free with up to 250 assets. Scale to Professional or Enterprise as your team grows.",
  path: "/pricing",
});

export default function PricingPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }

  return (
    <>
      <JsonLd
        data={getBreadcrumbSchema([
          { name: "Home", path: "/" },
          { name: "Pricing", path: "/pricing" },
        ])}
      />
      <PricingPageClient />
    </>
  );
}
