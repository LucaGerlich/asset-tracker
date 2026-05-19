import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { createPageMetadata, LANDING_FAQ } from "@/lib/seo";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  getSoftwareApplicationSchema,
  getOrganizationSchema,
  getFaqSchema,
} from "@/lib/structured-data";
import LandingPage from "@/components/marketing/LandingPage";

export const metadata = createPageMetadata({
  title: "IT Asset Management Software for Teams",
  description:
    "Track, manage, and optimize hardware, software licenses, and consumables with Asset Tracker. Free IT asset management platform built for modern teams.",
  path: "/",
});

export default async function Home() {
  let session = null;
  try {
    session = await auth.api.getSession({ headers: await headers() });
  } catch {
    // Ignore auth errors (e.g. stale JWT) — treat as unauthenticated
  }

  if (session?.user) {
    redirect("/dashboard");
  }

  // Self-hosted mode: skip landing page, go straight to login
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }

  return (
    <>
      <JsonLd data={getSoftwareApplicationSchema()} />
      <JsonLd data={getOrganizationSchema()} />
      <JsonLd data={getFaqSchema(LANDING_FAQ)} />
      <LandingPage />
    </>
  );
}
