import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import LandingPage from "@/components/marketing/LandingPage";

export const metadata = {
  title: "Trackly - IT Asset Management, Without the Complexity",
  description:
    "Track hardware, software licenses, and consumables across your organization. Built for IT teams that need clarity, not chaos.",
};

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

  return <LandingPage />;
}
