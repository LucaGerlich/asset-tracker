"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

// Client-only render of the heavy NextUI table to avoid SSR/hydration id mismatches
const DashboardTable = dynamic(() => import("../../../ui/assets/DashboardTable"), {
  ssr: false,
});

export default function AssetsTableClient(props) {
  return (
    <Suspense fallback={null}>
      <DashboardTable {...props} />
    </Suspense>
  );
}

