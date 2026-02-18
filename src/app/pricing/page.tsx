import { Metadata } from "next";
import PricingPageClient from "./PricingPageClient";

export const metadata: Metadata = {
  title: "Pricing - Asset Tracker",
  description:
    "Simple, transparent pricing for teams of all sizes. Start free and scale as you grow.",
};

export default function PricingPage() {
  return <PricingPageClient />;
}
