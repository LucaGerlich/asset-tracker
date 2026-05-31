"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  QrCode,
  Camera,
  Search,
  Loader2,
  Eye,
  LogOut,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import QRCodeDisplay from "./QRCodeDisplay";

interface AssetSearchResult {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  href: string;
}

interface ScannedAsset {
  assetid: string;
  assetname: string;
  assettag: string | null;
  serialnumber: string | null;
  statusType?: {
    statustypeid: string;
    statustypename: string;
  } | null;
  assignedUser?: string | null;
}

interface ScannerPageClientProps {
  isAdmin?: boolean;
}

export default function ScannerPageClient({
  isAdmin = true,
}: ScannerPageClientProps) {
  const router = useRouter();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<
    "prompt" | "granted" | "denied"
  >("prompt");
  const [lastDetected, setLastDetected] = useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = useState<ScannedAsset | null>(null);
  const [isLoadingAsset, setIsLoadingAsset] = useState(false);

  const [_manualTag, _setManualTag] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AssetSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<AssetSearchResult | null>(
    null,
  );

  useEffect(() => {
    return () => {
      stopScanning();
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
    } catch (err) {
      console.error("Camera access denied", err);
      setCameraPermission("denied");
      toast.error("Camera access denied. Please allow camera permissions.");
    }
  }, []);

  const startScanning = useCallback(async () => {
    if (!streamRef.current) {
      await requestCamera();
    }

    if (!streamRef.current) return;

    setScanning(true);
    setLastDetected(null);
    detectQR();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- detectQR is defined below, circular callback dependency
  }, [requestCamera]);

  // Process a detected QR code value (shared between scan methods)
  const handleDetectedValue = useCallback(
    async (rawValue: string) => {
      setLastDetected(rawValue);

      try {
        const url = new URL(rawValue);
        const pathMatch = url.pathname.match(/\/assets\/(.+)/);
        if (pathMatch) {
          const assetId = pathMatch[1];
          stopScanning();
          setIsLoadingAsset(true);
          setScannedAsset(null);

          try {
            const res = await fetch(
              `/api/asset/getAsset?id=${encodeURIComponent(assetId)}`,
            );
            if (!res.ok) throw new Error("Asset not found");
            const asset = await res.json();
            setScannedAsset({
              assetid: asset.assetid,
              assetname: asset.assetname,
              assettag: asset.assettag,
              serialnumber: asset.serialnumber,
              statusType: asset.statusType ?? null,
              assignedUser: null,
            });
            toast.success(`Asset found: ${asset.assetname}`);
          } catch (err) {
            console.error("Could not load asset details", err);
            toast.error(
              "Could not load asset details. Navigating to asset page.",
            );
            router.push(url.pathname);
          } finally {
            setIsLoadingAsset(false);
          }
          return true;
        }
      } catch {
        /* rawValue is not a valid URL; fall through to generic detection */
      }

      toast.info(`Detected: ${rawValue}`);
      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stopScanning is defined above, circular callback dependency
    [router],
  );

  // Use jsQR to decode QR codes from video frames — works on ALL browsers
  const detectQR = useCallback(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    let stopped = false;

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
        const handled = await handleDetectedValue(code.data);
        if (handled) {
          stopped = true;
          return;
        }
      }

      animFrameRef.current = requestAnimationFrame(scan);
    };

    scan();
  }, [handleDetectedValue]);

  const stopScanning = useCallback(() => {
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

  const scanAnother = useCallback(() => {
    setScannedAsset(null);
    setLastDetected(null);
    setIsLoadingAsset(false);
    startScanning();
  }, [startScanning]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery)}&type=assets`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error("Search failed");
        const data = await res.json();
        const mapped = (data.results || []).map(
          (r: Record<string, string>) => ({
            id: r.id,
            type: r.type,
            title: r.label || r.title || "",
            subtitle: r.sublabel || r.subtitle || "",
            href: r.href,
          }),
        );
        setSearchResults(mapped);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        toast.error("Search failed");
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">QR Code Scanner</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isAdmin
            ? "Scan asset QR codes or generate new ones"
            : "Scan asset QR codes to look up details"}
        </p>
      </div>

      <Tabs defaultValue="scan" className="w-full">
        <TabsList
          className={`grid w-full max-w-md ${isAdmin ? "grid-cols-2" : "grid-cols-1"}`}
        >
          <TabsTrigger value="scan" className="gap-2">
            <Camera className="h-4 w-4" />
            Scan
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="generate" className="gap-2">
              <QrCode className="h-4 w-4" />
              Generate
            </TabsTrigger>
          )}
        </TabsList>

        {/* ============ SCAN TAB ============ */}
        <TabsContent value="scan">
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6">
              {/* Hidden canvas for jsQR frame processing */}
              <canvas ref={canvasRef} className="hidden" aria-hidden="true" />

              {cameraPermission === "prompt" && (
                <div className="flex flex-col items-center gap-4 py-8">
                  <Camera className="text-muted-foreground h-12 w-12" />
                  <p className="text-muted-foreground max-w-sm text-center text-sm">
                    Camera access is required to scan QR codes. Click the button
                    below to grant permission.
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
                    Please enable camera permissions in your browser settings
                    and reload the page.
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
                      aria-label="Camera feed for scanning QR codes"
                    />
                    {scanning && (
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-48 w-48 rounded-lg border-2 border-white/50" />
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={scanning ? stopScanning : startScanning}
                    variant={scanning ? "destructive" : "default"}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    {scanning ? "Stop Scanning" : "Start Scanning"}
                  </Button>

                  {lastDetected && (
                    <div className="text-center text-sm">
                      <p className="text-muted-foreground">Last detected:</p>
                      <p className="font-mono font-medium break-all">
                        {lastDetected}
                      </p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ============ ACTION PANEL ============ */}
          {isLoadingAsset && (
            <Card className="mt-4">
              <CardContent className="flex items-center justify-center gap-3 p-6">
                <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                <p className="text-muted-foreground text-sm">
                  Loading asset details...
                </p>
              </CardContent>
            </Card>
          )}

          {scannedAsset && !isLoadingAsset && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Scanned Asset</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="truncate text-base font-semibold">
                      {scannedAsset.assetname}
                    </h3>
                    {scannedAsset.statusType && (
                      <Badge variant="secondary" className="shrink-0">
                        {scannedAsset.statusType.statustypename}
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    {scannedAsset.assettag && (
                      <>
                        <span className="text-muted-foreground">Tag</span>
                        <span className="font-mono">
                          {scannedAsset.assettag}
                        </span>
                      </>
                    )}
                    {scannedAsset.serialnumber && (
                      <>
                        <span className="text-muted-foreground">Serial</span>
                        <span className="font-mono">
                          {scannedAsset.serialnumber}
                        </span>
                      </>
                    )}
                    <span className="text-muted-foreground">Assigned To</span>
                    <span>{scannedAsset.assignedUser || "Unassigned"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    onClick={() =>
                      router.push(`/assets/${scannedAsset.assetid}`)
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      router.push(`/assets/${scannedAsset.assetid}`)
                    }
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Check Out
                  </Button>
                  <Button variant="outline" onClick={scanAnother}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Scan Another
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ GENERATE TAB ============ */}
        {isAdmin && (
          <TabsContent value="generate">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Search panel */}
              <Card>
                <CardContent className="p-6">
                  <div className="relative">
                    <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
                    <Input
                      placeholder="Search assets by name, tag, or serial..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  {searchLoading && (
                    <p className="text-muted-foreground mt-4 text-sm">
                      Searching...
                    </p>
                  )}

                  {!searchLoading &&
                    searchQuery.length >= 2 &&
                    searchResults.length === 0 && (
                      <p className="text-muted-foreground mt-4 text-sm">
                        No assets found.
                      </p>
                    )}

                  {searchResults.length > 0 && (
                    <div className="mt-4 max-h-[400px] space-y-2 overflow-y-auto">
                      {searchResults.map((result) => (
                        <Button
                          key={result.id}
                          type="button"
                          variant="outline"
                          onClick={() => setSelectedAsset(result)}
                          className={`hover:bg-accent h-auto w-full justify-start rounded-lg border p-3 text-left transition-colors ${
                            selectedAsset?.id === result.id
                              ? "border-primary bg-primary/5"
                              : "border-border"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">
                                {result.title}
                              </p>
                              <p className="text-muted-foreground truncate text-xs">
                                {result.subtitle}
                              </p>
                            </div>
                            <Badge variant="secondary" className="shrink-0">
                              {result.type}
                            </Badge>
                          </div>
                        </Button>
                      ))}
                    </div>
                  )}

                  {searchQuery.length < 2 && (
                    <div className="flex flex-col items-center gap-2 py-8">
                      <QrCode className="text-muted-foreground h-10 w-10" />
                      <p className="text-muted-foreground text-center text-sm">
                        Search for an asset to generate its QR code
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* QR code display panel */}
              <div>
                {selectedAsset ? (
                  <QRCodeDisplay
                    assetId={selectedAsset.id}
                    assetTag={
                      selectedAsset.subtitle
                        .split("\u2022")[0]
                        ?.replace("Tag:", "")
                        .trim() || selectedAsset.id
                    }
                    assetName={selectedAsset.title}
                  />
                ) : (
                  <Card className="mx-auto w-full max-w-sm">
                    <CardContent className="flex min-h-[300px] flex-col items-center justify-center gap-2 p-6">
                      <QrCode className="text-muted-foreground h-10 w-10" />
                      <p className="text-muted-foreground text-center text-sm">
                        Select an asset to view its QR code
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

// TypeScript declaration for BarcodeDetector Web API
declare global {
  interface BarcodeDetectorOptions {
    formats: string[];
  }

  interface DetectedBarcode {
    rawValue: string;
    format: string;
    boundingBox: DOMRectReadOnly;
    cornerPoints: { x: number; y: number }[];
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    detect(
      source: HTMLVideoElement | HTMLImageElement | ImageBitmap,
    ): Promise<DetectedBarcode[]>;
    static getSupportedFormats(): Promise<string[]>;
  }

  interface Window {
    BarcodeDetector: typeof BarcodeDetector;
  }
}
