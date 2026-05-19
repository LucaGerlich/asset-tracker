import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/lib/url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getBaseUrl();

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
