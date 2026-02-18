import React from "react";
import ScannerPageClient from "./ui/ScannerPageClient";

export const metadata = {
  title: "Asset Tracker - Scanner",
  description: "Scan and generate QR codes for assets",
};

export default function Page() {
  return <ScannerPageClient />;
}
