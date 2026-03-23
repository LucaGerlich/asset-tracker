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
import { MapPin } from "lucide-react";

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

  // Calculate center from all locations
  const centerLat =
    locations.reduce((sum, l) => sum + l.latitude, 0) / locations.length;
  const centerLng =
    locations.reduce((sum, l) => sum + l.longitude, 0) / locations.length;

  return (
    <div className="h-[400px] w-full overflow-hidden rounded-lg border">
      <Map
        center={[centerLng, centerLat]}
        zoom={locations.length === 1 ? 14 : 5}
      >
        <MapControls
          position="bottom-right"
          showZoom
          showCompass
          showFullscreen
        />

        {locations.map((loc) => (
          <MapMarker key={loc.id} position={[loc.longitude, loc.latitude]}>
            <MarkerContent>
              <div className="bg-primary text-primary-foreground ring-background flex h-8 w-8 items-center justify-center rounded-full shadow-md ring-2">
                <span className="text-xs font-bold">{loc.assetCount}</span>
              </div>
            </MarkerContent>

            <MarkerPopup>
              <div className="min-w-[160px] space-y-1.5 p-1">
                <p className="text-sm font-semibold">{loc.name}</p>
                <Badge variant="secondary" className="text-xs">
                  {loc.assetCount} asset{loc.assetCount !== 1 ? "s" : ""}
                </Badge>
              </div>
            </MarkerPopup>
          </MapMarker>
        ))}
      </Map>
    </div>
  );
}
