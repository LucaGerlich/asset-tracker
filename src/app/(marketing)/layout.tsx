import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getMarketingUrl } from "@/lib/url";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { MarketingFooter } from "@/components/marketing/MarketingFooter";

// The root layout sets metadataBase to the app URL; marketing pages (OG image,
// canonicals) must resolve against the marketing origin.
export const metadata: Metadata = { metadataBase: new URL(getMarketingUrl()) };

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mkt bg-mkt-bg text-mkt-text font-mkt-sans flex min-h-screen flex-col">
      <MarketingNav />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
    </div>
  );
}
