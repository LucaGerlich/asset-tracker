"use client";

import React, { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

interface LocationMarker {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  assetCount: number;
}

export default function AssetMap({
  locations,
}: {
  locations: LocationMarker[];
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current || locations.length === 0) return;

    // Use Carto Voyager tiles (free, no API key, designed for embedding)
    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
              "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png",
            ],
            tileSize: 256,
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
          },
        },
        layers: [
          {
            id: "carto",
            type: "raster",
            source: "carto",
          },
        ],
      },
      center: [locations[0].longitude, locations[0].latitude],
      zoom: 14,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    // Add markers for each location
    const bounds = new maplibregl.LngLatBounds();

    for (const loc of locations) {
      const popup = new maplibregl.Popup({ offset: 25 }).setHTML(
        `<div style="font-family: sans-serif; padding: 4px;">
          <strong>${loc.name}</strong>
          <br/><span style="color: #666; font-size: 12px;">${loc.assetCount} asset${loc.assetCount !== 1 ? "s" : ""}</span>
        </div>`,
      );

      new maplibregl.Marker({ color: "#2563eb" })
        .setLngLat([loc.longitude, loc.latitude])
        .setPopup(popup)
        .addTo(map.current);

      bounds.extend([loc.longitude, loc.latitude]);
    }

    // Fit map to show all markers
    if (locations.length > 1) {
      map.current.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return () => {
      map.current?.remove();
    };
  }, [locations]);

  if (locations.length === 0) {
    return (
      <div className="text-muted-foreground flex h-64 items-center justify-center rounded-lg border border-dashed text-sm">
        No locations with coordinates. Edit a location to geocode its address.
      </div>
    );
  }

  return (
    <div
      ref={mapContainer}
      className="h-[400px] w-full overflow-hidden rounded-lg border"
    />
  );
}
