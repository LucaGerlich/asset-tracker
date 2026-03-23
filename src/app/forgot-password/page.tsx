import { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Asset Tracker - Forgot Password",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
