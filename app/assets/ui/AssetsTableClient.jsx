"use client";
import dynamic from "next/dynamic";

const AssetsDataTable = dynamic(() => import("../../ui/assets/AssetsDataTable"), { ssr: false });

export default function AssetsTableClient(props) {
  return <AssetsDataTable {...props} />;
}
