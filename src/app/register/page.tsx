import { Metadata } from "next";
import { redirect } from "next/navigation";
import { isFeatureEnabled } from "@/lib/feature-flags";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Register | Asset Tracker",
};

export default function RegisterPage() {
  if (isFeatureEnabled("selfHosted")) {
    redirect("/login");
  }

  return <RegisterForm />;
}
