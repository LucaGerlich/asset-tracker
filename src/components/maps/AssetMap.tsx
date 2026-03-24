"use client";

import React from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
} from "@/components/ui/map";
import { Badge } from "@/components/ui/badge";
import { MapPin, TrendingUp, Boxes } from "lucide-react";

interface LocationMarker {
  id: string;
  name: string | null;
  latitude: number;
  longitude: number;
  assetCount: number;
}

interface AssetMapProps {
  locations: LocationMarker[];
  totalAssets?: number;
  totalLocations?: number;
}

function getMarkerSize(count: number): "sm" | "md" | "lg" {
  if (count >= 10) return "lg";
  if (count >= 3) return "md";
  return "sm";
}

const markerSizes = {
  sm: {
    outer: "h-6 w-6",
    inner: "h-4 w-4",
    pulse: "h-10 w-10",
    text: "text-[9px]",
  },
  md: {
    outer: "h-9 w-9",
    inner: "h-6 w-6",
    pulse: "h-14 w-14",
    text: "text-[11px]",
  },
  lg: {
    outer: "h-12 w-12",
    inner: "h-8 w-8",
    pulse: "h-16 w-16",
    text: "text-xs",
  },
};

export default function AssetMap({
  locations: rawLocations,
  totalAssets,
  totalLocations,
}: AssetMapProps) {
  // Filter out locations with invalid coordinates to prevent MapLibre NaN crash
  const locations = rawLocations.filter(
    (l) =>
      typeof l.latitude === "number" &&
      typeof l.longitude === "number" &&
      !isNaN(l.latitude) &&
      !isNaN(l.longitude),
  );

  if (locations.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm">
        <div className="text-center">
          <MapPin className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
          <p>No locations with coordinates.</p>
          <p className="text-xs">Edit a location to geocode its address.</p>
        </div>
      </div>
    );
  }

  const centerLat =
    locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
  const centerLng =
    locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg border">
      <Map
        center={[centerLng, centerLat]}
        zoom={locations.length === 1 ? 13 : 4}
      >
        <MapControls position="bottom-right" showZoom showCompass />

        {locations.map((loc) => {
          const size = getMarkerSize(loc.assetCount);
          const s = markerSizes[size];

          return (
            <MapMarker key={loc.id} position={[loc.longitude, loc.latitude]}>
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  {/* Pulse ring */}
                  <div
                    className={`absolute ${s.pulse} animate-ping rounded-full bg-emerald-400/20`}
                    style={{ animationDuration: "3s" }}
                  />
                  {/* Glow */}
                  <div
                    className={`absolute ${s.outer} rounded-full bg-emerald-400/30 blur-sm`}
                  />
                  {/* Solid marker */}
                  <div
                    className={`relative ${s.inner} flex items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-2 shadow-emerald-500/30 ring-white/80`}
                  >
                    <span className={`font-bold text-white ${s.text}`}>
                      {loc.assetCount}
                    </span>
                  </div>
                </div>
              </MarkerContent>

              <MarkerPopup>
                <div className="min-w-[180px] space-y-2 p-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                    <p className="text-sm font-semibold">
                      {loc.name ?? "Unknown"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Boxes className="text-muted-foreground h-3.5 w-3.5" />
                    <span className="text-muted-foreground text-xs">
                      {loc.assetCount} asset
                      {loc.assetCount !== 1 ? "s" : ""} at this location
                    </span>
                  </div>
                </div>
              </MarkerPopup>
            </MapMarker>
          );
        })}
      </Map>

      {/* Stats overlay — top left */}
      {totalAssets !== undefined && (
        <div className="pointer-events-none absolute top-3 left-3 z-10">
          <div className="bg-background/90 pointer-events-auto rounded-lg border px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Total Assets
            </p>
            <p className="text-2xl font-bold tabular-nums">{totalAssets}</p>
            <div className="mt-1 flex items-center gap-1 text-emerald-600">
              <TrendingUp className="h-3 w-3" />
              <span className="text-[11px] font-medium">
                {totalLocations ?? locations.length} location
                {(totalLocations ?? locations.length) !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Legend — bottom left */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-10">
        <div className="bg-background/90 pointer-events-auto flex items-center gap-3 rounded-md border px-3 py-1.5 text-[11px] shadow-sm backdrop-blur-sm">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            High
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Medium
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Low
          </span>
        </div>
      </div>
    </div>
  );
}
