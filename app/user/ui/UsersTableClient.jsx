"use client";
import dynamic from "next/dynamic";

const UsersDataTable = dynamic(() => import("../../ui/user/UsersDataTable"), { ssr: false });

export default function UsersTableClient(props) {
  return <UsersDataTable {...props} />;
}
