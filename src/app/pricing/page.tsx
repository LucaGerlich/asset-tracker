import { Metadata } from "next";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing - Asset Tracker",
  description:
    "Simple, transparent pricing for teams of all sizes. Start free and scale as you grow.",
};

export default function PricingPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }

  return <PricingPageClient />;
}
