import { Metadata } from "next";
import { redirect } from "next/navigation";
import { isPublicSignupEnabled } from "@/lib/signup";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Asset Tracker - Register",
};

export default function RegisterPage() {
  if (!isPublicSignupEnabled()) {
    redirect("/login");
  }

  return <RegisterForm />;
}
