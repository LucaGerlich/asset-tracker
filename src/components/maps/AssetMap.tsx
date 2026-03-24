"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPin } from "lucide-react";

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

export default function AssetMap({
  locations: rawLocations,
  totalAssets,
  totalLocations,
}: AssetMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  const locations = rawLocations.filter(
    (l) =>
      typeof l.latitude === "number" &&
      typeof l.longitude === "number" &&
      !isNaN(l.latitude) &&
      !isNaN(l.longitude),
  );

  useEffect(() => {
    if (!mapContainer.current || locations.length === 0) return;

    const isDark = document.documentElement.classList.contains("dark");
    const style = isDark
      ? "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json"
      : "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style,
      center: [
        locations.reduce((s, l) => s + l.longitude, 0) / locations.length,
        locations.reduce((s, l) => s + l.latitude, 0) / locations.length,
      ],
      zoom: locations.length === 1 ? 13 : 4,
    });

    map.current.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "bottom-right",
    );

    const bounds = new maplibregl.LngLatBounds();

    for (const loc of locations) {
      const size = loc.assetCount >= 10 ? 40 : loc.assetCount >= 3 ? 32 : 24;

      const el = document.createElement("div");
      el.style.width = `${size}px`;
      el.style.height = `${size}px`;
      el.style.borderRadius = "50%";
      el.style.background = "#10b981";
      el.style.border = "2px solid rgba(255,255,255,0.8)";
      el.style.boxShadow = "0 0 12px rgba(16,185,129,0.4)";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.color = "white";
      el.style.fontWeight = "bold";
      el.style.fontSize = size >= 40 ? "13px" : size >= 32 ? "11px" : "9px";
      el.style.cursor = "pointer";
      el.textContent = String(loc.assetCount);

      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="font-family:system-ui,sans-serif;padding:4px 2px;">
          <strong style="font-size:14px;">${loc.name ?? "Unknown"}</strong>
          <br/><span style="color:#666;font-size:12px;">${loc.assetCount} asset${loc.assetCount !== 1 ? "s" : ""} at this location</span>
        </div>`,
      );

      new maplibregl.Marker({ element: el })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(popup)
        .addTo(map.current);

      bounds.extend([loc.longitude, loc.latitude]);
    }

    if (locations.length > 1) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return () => {
      map.current?.remove();
    };
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[300px] items-center justify-center rounded-lg border border-dashed text-sm">
        <div className="text-center">
          <MapPin className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
          <p>No locations with coordinates.</p>
          <p className="text-xs">Edit a location to geocode its address.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[300px] w-full overflow-hidden rounded-lg border">
      <div ref={mapContainer} className="h-full w-full" />

      {/* Stats overlay */}
      {totalAssets !== undefined && (
        <div className="pointer-events-none absolute top-3 left-3 z-10">
          <div className="bg-background/90 pointer-events-auto rounded-lg border px-4 py-3 shadow-sm backdrop-blur-sm">
            <p className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              Total Assets
            </p>
            <p className="text-2xl font-bold tabular-nums">{totalAssets}</p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
              {totalLocations ?? locations.length} location
              {(totalLocations ?? locations.length) !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
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
