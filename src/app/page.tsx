import { auth } from "@/auth";
import { redirect } from "next/navigation";
import LandingPage from "@/components/marketing/LandingPage";

export const metadata = {
  title: "Asset Tracker - Modern Asset Management for Teams",
  description:
    "Track, manage, and optimize your organization's assets, licenses, and consumables with Asset Tracker.",
};

export default async function Home() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }
  return <LandingPage />;
}
