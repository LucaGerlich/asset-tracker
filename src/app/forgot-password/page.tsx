import { Metadata } from "next";
import ForgotPasswordForm from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Forgot Password - Asset Tracker",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
