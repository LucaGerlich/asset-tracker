"use client";

import dynamic from "next/dynamic";

// Client-only render of the heavy NextUI table to avoid SSR/hydration id mismatches
const DashboardTable = dynamic(() => import("../../../ui/assets/DashboardTable"), {
  ssr: false,
});

export default function AssetsTableClient(props) {
  return <DashboardTable {...props} />;
}

