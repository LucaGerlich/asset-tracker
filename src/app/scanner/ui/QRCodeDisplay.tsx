"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Printer } from "lucide-react";

interface QRCodeDisplayProps {
  assetId: string;
  assetTag: string;
  assetName: string;
}

export default function QRCodeDisplay({
  assetId,
  assetTag,
  assetName,
}: QRCodeDisplayProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchQR() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/asset/qrcode/${assetId}?format=png`);
        if (!res.ok) {
          throw new Error("Failed to load QR code");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (!cancelled) {
          setImageSrc(url);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load QR code"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchQR();

    return () => {
      cancelled = true;
    };
  }, [assetId]);

  const handleDownload = () => {
    if (!imageSrc) return;
    const a = document.createElement("a");
    a.href = imageSrc;
    a.download = `qr-${assetTag || assetId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handlePrint = () => {
    if (!imageSrc) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const doc = printWindow.document;

    const style = doc.createElement("style");
    style.textContent = [
      "body {",
      "  display: flex; flex-direction: column; align-items: center;",
      "  justify-content: center; min-height: 100vh; margin: 0;",
      "  font-family: system-ui, -apple-system, sans-serif;",
      "}",
      "img { max-width: 300px; }",
      ".label { margin-top: 12px; font-size: 14px; text-align: center; }",
      ".tag { font-weight: 600; font-size: 16px; }",
      "@media print { body { padding: 20mm; } }",
    ].join("\n");
    doc.head.appendChild(style);

    const title = doc.createElement("title");
    title.textContent = `QR Code - ${assetTag}`;
    doc.head.appendChild(title);

    const img = doc.createElement("img");
    img.src = imageSrc;
    img.alt = "QR Code";
    doc.body.appendChild(img);

    const label = doc.createElement("div");
    label.className = "label";

    const tagEl = doc.createElement("div");
    tagEl.className = "tag";
    tagEl.textContent = assetTag;
    label.appendChild(tagEl);

    const nameEl = doc.createElement("div");
    nameEl.textContent = assetName;
    label.appendChild(nameEl);

    doc.body.appendChild(label);

    img.onload = () => {
      printWindow.print();
    };
  };

  return (
    <Card className="w-full max-w-sm mx-auto">
      <CardContent className="flex flex-col items-center gap-4 p-6">
        {loading && (
          <div className="flex items-center justify-center w-[300px] h-[300px] bg-muted rounded animate-pulse">
            <span className="text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center w-[300px] h-[300px] bg-muted rounded">
            <span className="text-sm text-destructive">{error}</span>
          </div>
        )}

        {imageSrc && !loading && (
          <img
            src={imageSrc}
            alt={`QR Code for ${assetTag}`}
            className="w-[300px] h-[300px]"
          />
        )}

        <div className="text-center">
          <p className="font-semibold text-sm">{assetTag}</p>
          <p className="text-sm text-muted-foreground">{assetName}</p>
        </div>

        <div className="flex gap-2 w-full">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleDownload}
            disabled={!imageSrc}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrint}
            disabled={!imageSrc}
          >
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
