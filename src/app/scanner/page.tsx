import React from "react";
import Breadcrumb from "@/components/Breadcrumb";
import ScannerPageClient from "./ui/ScannerPageClient";

export const metadata = {
  title: "Asset Tracker - QR Scanner",
  description: "Scan and generate QR codes for assets",
};

export default function Page() {
  return (
    <>
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "QR Scanner", href: "/scanner" },
        ]}
      />
      <ScannerPageClient />
    </>
  );
}
