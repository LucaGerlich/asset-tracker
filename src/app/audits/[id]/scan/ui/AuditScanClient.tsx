"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CheckCircle2, Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";

interface AuditScanProps {
  campaignId: string;
  campaignName: string;
  entries: Array<{
    id: string;
    assetId: string;
    status: string;
    asset: { assetid: string; assetname: string; assettag: string };
  }>;
}

interface ScannedItem {
  assetId: string;
  assetName: string;
  assetTag: string;
  status: string;
  timestamp: Date;
}

export default function AuditScanClient({
  campaignId,
  campaignName,
  entries: initialEntries,
}: AuditScanProps) {
  const router = useRouter();

  // Entry state (mutated locally as scans happen)
  const [entries, setEntries] = useState(initialEntries);
  const [recentScans, setRecentScans] = useState<ScannedItem[]>([]);

  // Camera state
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");

  // Scan-in-flight guard to prevent duplicate scans
  const scanningAssetRef = useRef<Set<string>>(new Set());

  // Manual entry state
  const [manualTag, setManualTag] = useState("");
  const [manualLoading, setManualLoading] = useState(false);

  // Progress calculations
  const total = entries.length;
  const scannedCount = entries.filter((e) => e.status !== "unscanned").length;
  const progressPercent =
    total > 0 ? Math.round((scannedCount / total) * 100) : 0;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraPermission("granted");
      toast.success("Camera access granted");
    } catch {
      setCameraPermission("denied");
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    setScanning(false);

    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Submit a scan to the API
  const submitScan = useCallback(
    async (assetId: string) => {
      // Prevent duplicate concurrent scans for same asset
      if (scanningAssetRef.current.has(assetId)) return;

      // Check if already scanned
      const entry = entries.find((e) => e.assetId === assetId);
      if (entry && entry.status !== "unscanned") {
        toast.info(`${entry.asset.assetname} already scanned`);
        return;
      }

      scanningAssetRef.current.add(assetId);

      try {
        const res = await fetch(`/api/audits/${campaignId}/scan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assetId, status: "found" }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Scan failed");
        }

        // Find the asset info from entries
        const matchedEntry = entries.find((e) => e.assetId === assetId);
        const assetName = matchedEntry?.asset.assetname || "Unknown asset";
        const assetTag = matchedEntry?.asset.assettag || "";

        // Update local entries
        setEntries((prev) =>
          prev.map((e) =>
            e.assetId === assetId ? { ...e, status: "found" } : e,
          ),
        );

        // Add to recent scans
        setRecentScans((prev) => [
          {
            assetId,
            assetName,
            assetTag,
            status: "found",
            timestamp: new Date(),
          },
          ...prev,
        ]);

        toast.success(`Scanned: ${assetName}`);
      } catch (err: any) {
        toast.error(err.message || "Failed to scan asset");
      } finally {
        scanningAssetRef.current.delete(assetId);
      }
    },
    [campaignId, entries],
  );

  // Extract asset ID from a QR code URL
  const extractAssetId = useCallback((rawValue: string): string | null => {
    try {
      const url = new URL(rawValue);
      const pathMatch = url.pathname.match(/\/assets\/(.+)/);
      if (pathMatch) return pathMatch[1];
    } catch {
      // Not a URL -- ignore
    }
    return null;
  }, []);

  // Handle a detected QR code value
  const handleDetectedValue = useCallback(
    async (rawValue: string) => {
      const assetId = extractAssetId(rawValue);
      if (!assetId) return;

      await submitScan(assetId);
    },
    [extractAssetId, submitScan],
  );

  // jsQR frame scanning loop
  const detectQR = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let stopped = false;
    // Cooldown: after a successful detection, wait before detecting again
    let lastDetectedValue = "";
    let lastDetectedTime = 0;

    const scan = async () => {
      if (stopped || !streamRef.current) return;

      if (video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });

      if (code && code.data) {
        const now = Date.now();
        // Debounce: skip if same code detected within 3 seconds
        if (code.data !== lastDetectedValue || now - lastDetectedTime > 3000) {
          lastDetectedValue = code.data;
          lastDetectedTime = now;
          await handleDetectedValue(code.data);
        }
      }

      // Continue scanning -- don't stop after one scan
      animFrameRef.current = requestAnimationFrame(scan);
    };

    scan();

    return () => {
      stopped = true;
    };
  }, [handleDetectedValue]);

  const startScanning = useCallback(async () => {
    if (!streamRef.current) {
      await requestCamera();
    }
    if (!streamRef.current) return;

    setScanning(true);
    detectQR();
  }, [requestCamera, detectQR]);

  const toggleScanning = useCallback(() => {
    if (scanning) {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = null;
      }
      setScanning(false);
    } else {
      startScanning();
    }
  }, [scanning, startScanning]);

  // Manual tag entry
  const handleManualEntry = useCallback(async () => {
    const tag = manualTag.trim();
    if (!tag) return;

    setManualLoading(true);

    // Find matching entry by asset tag
    const matchedEntry = entries.find(
      (e) => e.asset.assettag.toLowerCase() === tag.toLowerCase(),
    );

    if (!matchedEntry) {
      toast.error(`No asset with tag "${tag}" found in this audit`);
      setManualLoading(false);
      return;
    }

    await submitScan(matchedEntry.assetId);
    setManualTag("");
    setManualLoading(false);
  }, [manualTag, entries, submitScan]);

  const handleFinish = useCallback(() => {
    stopCamera();
    router.push(`/audits/${campaignId}`);
  }, [stopCamera, router, campaignId]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Audit Scan</h1>
          <p className="text-muted-foreground mt-1 text-sm">{campaignName}</p>
        </div>
        <Button variant="outline" onClick={handleFinish}>
          Finish
        </Button>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">
              {scannedCount} of {total} scanned
            </span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="bg-muted mt-2 h-3 overflow-hidden rounded-full">
            <div
              className="bg-primary h-full rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Camera feed */}
      <Card>
        <CardContent className="flex flex-col items-center gap-4 p-6">
          {/* Hidden canvas for jsQR frame processing */}
          <canvas ref={canvasRef} className="hidden" />

          {cameraPermission === "prompt" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Camera className="text-muted-foreground h-12 w-12" />
              <p className="text-muted-foreground max-w-sm text-center text-sm">
                Camera access is required to scan asset QR codes. Click the
                button below to grant permission.
              </p>
              <Button onClick={requestCamera}>
                <Camera className="mr-2 h-4 w-4" />
                Allow Camera Access
              </Button>
            </div>
          )}

          {cameraPermission === "denied" && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-center text-sm text-red-800 dark:border-red-600 dark:bg-red-950 dark:text-red-200">
              <p className="mb-1 font-medium">Camera access denied</p>
              <p>
                Please enable camera permissions in your browser settings and
                reload the page. You can still use manual entry below.
              </p>
            </div>
          )}

          {cameraPermission === "granted" && (
            <>
              <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-black">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="aspect-video w-full object-cover"
                />
                {scanning && (
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="h-48 w-48 rounded-lg border-2 border-white/50" />
                  </div>
                )}
              </div>

              <Button
                onClick={toggleScanning}
                variant={scanning ? "destructive" : "default"}
              >
                <Camera className="mr-2 h-4 w-4" />
                {scanning ? "Pause Scanning" : "Start Scanning"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Manual entry fallback */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            Enter an asset tag manually if the QR code is damaged or unreadable.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
              <Input
                placeholder="Enter asset tag..."
                value={manualTag}
                onChange={(e) => setManualTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleManualEntry();
                }}
                className="pl-10"
              />
            </div>
            <Button
              onClick={handleManualEntry}
              disabled={!manualTag.trim() || manualLoading}
            >
              {manualLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-4 w-4" />
              )}
              Mark Found
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recently scanned items */}
      {recentScans.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Recently Scanned ({recentScans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[300px] space-y-2 overflow-y-auto">
              {recentScans.map((item, idx) => (
                <div
                  key={`${item.assetId}-${idx}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {item.assetName}
                    </p>
                    {item.assetTag && (
                      <p className="text-muted-foreground truncate font-mono text-xs">
                        {item.assetTag}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      {item.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unscanned items summary */}
      {entries.filter((e) => e.status === "unscanned").length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <XCircle className="h-4 w-4 text-yellow-500" />
              Remaining (
              {entries.filter((e) => e.status === "unscanned").length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[200px] space-y-1 overflow-y-auto">
              {entries
                .filter((e) => e.status === "unscanned")
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="text-muted-foreground flex items-center justify-between py-1 text-sm"
                  >
                    <span className="truncate">{entry.asset.assetname}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {entry.asset.assettag}
                    </span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
