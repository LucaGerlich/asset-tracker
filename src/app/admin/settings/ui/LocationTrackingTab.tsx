"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { MapPin, Radio, Settings, Loader2 } from "lucide-react";

export default function LocationTrackingTab() {
  // ---- GPS Tracking state --------------------------------------------------
  const [gpsEnabled, setGpsEnabled] = useState(false);
  const [gpsInterval, setGpsInterval] = useState("15");
  const [geofencingEnabled, setGeofencingEnabled] = useState(false);

  // ---- RFID/NFC state ------------------------------------------------------
  const [rfidEnabled, setRfidEnabled] = useState(false);
  const [readerType, setReaderType] = useState("fixed");
  const [autoAssignLocation, setAutoAssignLocation] = useState(false);

  // ---- Tracking Policies state ---------------------------------------------
  const [trackAllAssets, setTrackAllAssets] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [retentionPeriod, setRetentionPeriod] = useState("90");

  // ---- Save (scaffolding only) ---------------------------------------------
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave() {
    setIsSaving(true);
    // Simulate a short delay to feel realistic
    await new Promise((resolve) => setTimeout(resolve, 500));
    setIsSaving(false);
    toast.success("Location tracking settings saved");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Tracking
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure GPS tracking, RFID/NFC readers, and tracking policies for
          asset location management.
        </p>
      </div>

      <Separator />

      {/* Card 1: GPS Tracking */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            GPS Tracking
          </CardTitle>
          <CardDescription>
            Enable real-time GPS tracking for assets with location hardware.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable GPS */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Enable GPS Tracking</Label>
              <p className="text-xs text-muted-foreground">
                Track asset locations using GPS-enabled hardware
              </p>
            </div>
            <Switch checked={gpsEnabled} onCheckedChange={setGpsEnabled} />
          </div>

          {/* Update interval */}
          <div className="space-y-2">
            <Label htmlFor="gps-interval">Update Interval</Label>
            <Select value={gpsInterval} onValueChange={setGpsInterval}>
              <SelectTrigger id="gps-interval" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5 minutes</SelectItem>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="60">1 hour</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How often asset locations are updated
            </p>
          </div>

          {/* Geofencing */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Geofencing</Label>
              <p className="text-xs text-muted-foreground">
                Trigger alerts when assets leave designated areas
              </p>
            </div>
            <Switch
              checked={geofencingEnabled}
              onCheckedChange={setGeofencingEnabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 2: RFID/NFC Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Radio className="h-4 w-4" />
            RFID/NFC Configuration
          </CardTitle>
          <CardDescription>
            Configure RFID and NFC readers for automated asset identification.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable RFID/NFC */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Enable RFID/NFC</Label>
              <p className="text-xs text-muted-foreground">
                Use RFID/NFC readers for asset tracking
              </p>
            </div>
            <Switch checked={rfidEnabled} onCheckedChange={setRfidEnabled} />
          </div>

          {/* Reader type */}
          <div className="space-y-2">
            <Label htmlFor="reader-type">Reader Type</Label>
            <Select value={readerType} onValueChange={setReaderType}>
              <SelectTrigger id="reader-type" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="handheld">Handheld</SelectItem>
                <SelectItem value="both">Both</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The type of RFID/NFC readers deployed in your environment
            </p>
          </div>

          {/* Auto-assign location */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Auto-assign Location</Label>
              <p className="text-xs text-muted-foreground">
                Automatically update asset location when scanned by a reader
              </p>
            </div>
            <Switch
              checked={autoAssignLocation}
              onCheckedChange={setAutoAssignLocation}
            />
          </div>
        </CardContent>
      </Card>

      {/* Card 3: Tracking Policies */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            Tracking Policies
          </CardTitle>
          <CardDescription>
            Define which assets to track and how long to retain location
            history.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Track all assets */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Track All Assets</Label>
              <p className="text-xs text-muted-foreground">
                Enable location tracking for all assets in the system
              </p>
            </div>
            <Switch
              checked={trackAllAssets}
              onCheckedChange={setTrackAllAssets}
            />
          </div>

          {/* Category filter */}
          <div className="space-y-2">
            <Label htmlFor="category-filter">Category Filter</Label>
            <Input
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="Filter by asset category..."
              disabled={trackAllAssets}
            />
            <p className="text-xs text-muted-foreground">
              Only track assets in specific categories (disabled when tracking
              all assets)
            </p>
          </div>

          {/* Location history retention */}
          <div className="space-y-2">
            <Label htmlFor="retention-period">
              Location History Retention
            </Label>
            <Select
              value={retentionPeriod}
              onValueChange={setRetentionPeriod}
            >
              <SelectTrigger id="retention-period" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 days</SelectItem>
                <SelectItem value="90">90 days</SelectItem>
                <SelectItem value="365">1 year</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              How long location history records are kept before being purged
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
