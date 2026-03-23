import { Metadata } from "next";
import SetupForm from "./SetupForm";

export const metadata: Metadata = {
  title: "Asset Tracker - Setup",
};

export default function SetupPage() {
  return <SetupForm />;
}
