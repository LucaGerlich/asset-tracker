import type { MetadataRoute } from "next";
import { getSplitOrigins } from "@/lib/host-routing";
import { getMarketingUrl } from "@/lib/url";

// /login and /register live on the app host once the domain split is enabled.
const APP_ONLY = new Set(["/register", "/login"]);

const ENTRIES: {
  path: string;
  changeFrequency: "weekly" | "monthly" | "yearly";
  priority: number;
}[] = [
  { path: "", changeFrequency: "weekly", priority: 1.0 },
  { path: "/pricing", changeFrequency: "monthly", priority: 0.8 },
  { path: "/register", changeFrequency: "monthly", priority: 0.6 },
  { path: "/login", changeFrequency: "monthly", priority: 0.5 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getMarketingUrl();
  const split = getSplitOrigins() !== null;

  return ENTRIES.filter((e) => !(split && APP_ONLY.has(e.path))).map((e) => ({
    url: `${baseUrl}${e.path}`,
    lastModified: new Date(),
    changeFrequency: e.changeFrequency,
    priority: e.priority,
  }));
}
