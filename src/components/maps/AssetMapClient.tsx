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

export default function AssetMapClient(
  props: React.ComponentProps<typeof AssetMap>,
) {
  return <AssetMap {...props} />;
}
