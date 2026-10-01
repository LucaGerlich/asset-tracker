import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { getHostKind, getSplitOrigins } from "@/lib/host-routing";
import { getMarketingUrl } from "@/lib/url";

// The proxy reads the split env at runtime; render per request so a build
// without NEXT_PUBLIC_MARKETING_URL (e.g. a Docker image) still answers per host.
export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  // With the domain split, the app host must not be indexed at all.
  const origins = getSplitOrigins();
  if (
    origins &&
    getHostKind((await headers()).get("host"), origins) === "app"
  ) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const baseUrl = getMarketingUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/pricing", "/terms", "/privacy"],
        disallow: [
          "/api/",
          "/admin/",
          "/assets/",
          "/accessories/",
          "/consumables/",
          "/components/",
          "/licences/",
          "/kits/",
          "/user/",
          "/dashboard/",
          "/audits/",
          "/maintenance/",
          "/reports/",
          "/import/",
          "/scanner/",
          "/search/",
          "/reservations/",
          "/approvals/",
          "/tickets/",
          "/locations/",
          "/manufacturers/",
          "/models/",
          "/suppliers/",
          "/statusTypes/",
          "/assetCategories/",
          "/accessoryCategories/",
          "/consumableCategories/",
          "/licenceCategories/",
          "/componentCategories/",
          "/setup",
          "/mfa-verify",
          "/set-password/",
          "/invite/",
          "/monitoring",
          "/forgot-password",
          "/reset-password",
          "/suspended",
          "/offline",
          "/duplicates",
          "/tco",
          "/procurement/",
          "/help",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
