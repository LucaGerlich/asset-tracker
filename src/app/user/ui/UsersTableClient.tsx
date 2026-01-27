"use client";

import dynamic from "next/dynamic";

const DashboardTable = dynamic(() => import("../../../ui/user/DashboardTable"), {
  ssr: false,
});

export default function UsersTableClient(props) {
  return <DashboardTable {...props} />;
}

