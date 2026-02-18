"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";

const DashboardTable = dynamic(() => import("../../../ui/user/DashboardTable"), {
  ssr: false,
});

export default function UsersTableClient(props) {
  return (
    <Suspense fallback={null}>
      <DashboardTable {...props} />
    </Suspense>
  );
}

