import { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = {
  title: "Register | Asset Tracker",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
