"use client";

import dynamic from "next/dynamic";

const AssetMap = dynamic(() => import("./AssetMap"), {
  ssr: false,
  loading: () => (
    <div className="text-muted-foreground flex h-[300px] items-center justify-center rounded-lg border text-sm">
      Loading map...
    </div>
  ),
});

interface AssetMapClientProps {
  locations: Array<{
    id: string;
    name: string | null;
    latitude: number;
    longitude: number;
    assetCount: number;
  }>;
  totalAssets?: number;
  totalLocations?: number;
}

export default function AssetMapClient(props: AssetMapClientProps) {
  return <AssetMap {...props} />;
}
