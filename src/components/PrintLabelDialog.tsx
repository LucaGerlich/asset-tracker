"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QRCodeSVG } from "qrcode.react";
import { Download, Loader2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useDymo } from "@/hooks/useDymo";
import {
  buildDymoLabelXml,
  DYMO_LABEL_SIZES,
  type DymoLabelSize,
} from "@/lib/dymo-labels";
import { printDymoLabel } from "@/lib/dymo";
import { renderLabelTemplate } from "@/lib/label-renderer";

interface LabelTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  layout: string;
  includeQR: boolean;
  includeLogo: boolean;
  fields: string;
  isDefault: boolean;
}

interface AssetData {
  assetid: string;
  assetname: string;
  assettag: string;
  serialnumber: string;
  manufacturerid?: string;
  modelid?: string;
  locationid?: string;
  assetcategorytypeid?: string;
  purchasedate?: string;
  purchaseprice?: string;
  status?: string;
  assignedto?: string;
}

interface PrintLabelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assets: AssetData[];
  manufacturers?: Array<{ manufacturerid: string; manufacturername: string }>;
  models?: Array<{ modelid: string; modelname: string }>;
  locations?: Array<{ locationid: string; locationname: string }>;
  categories?: Array<{
    assetcategorytypeid: string;
    assetcategorytypename: string;
  }>;
}

const FIELD_LABELS: Record<string, string> = {
  assetName: "Asset Name",
  assetTag: "Asset Tag",
  serialNumber: "Serial Number",
  manufacturer: "Manufacturer",
  model: "Model",
  location: "Location",
  category: "Category",
  purchaseDate: "Purchase Date",
};

/** Check whether a template layout string uses {{placeholder}} syntax */
function isTemplateString(layout: string | undefined): boolean {
  return typeof layout === "string" && layout.includes("{{");
}

export default function PrintLabelDialog({
  open,
  onOpenChange,
  assets,
  manufacturers = [],
  models = [],
  locations = [],
  categories = [],
}: PrintLabelDialogProps) {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const printRef = useRef<HTMLDivElement>(null);

  // DYMO state
  const dymo = useDymo();
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [selectedDymoSize, setSelectedDymoSize] = useState<string>("30334");
  const [customWidth, setCustomWidth] = useState<string>("2.25");
  const [customHeight, setCustomHeight] = useState<string>("1.25");
  const [isDymoPrinting, setIsDymoPrinting] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/labels");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        const defaultTemplate = data.find((t: LabelTemplate) => t.isDefault);
        if (defaultTemplate) {
          setSelectedTemplateId(defaultTemplate.id);
        } else if (data.length > 0) {
          setSelectedTemplateId(data[0].id);
        }
      }
    } catch {
      /* template fetch failure is non-critical; dialog still usable */
    }
  }, []);

  useEffect(() => {
    if (open) fetchTemplates();
  }, [open, fetchTemplates]);

  useEffect(() => {
    if (dymo.printers.length > 0 && !selectedPrinter) {
      setSelectedPrinter(dymo.printers[0].name);
    }
  }, [dymo.printers, selectedPrinter]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId);

  const getFieldValue = (asset: AssetData, field: string): string => {
    switch (field) {
      case "assetName":
        return asset.assetname || "";
      case "assetTag":
        return asset.assettag || "";
      case "serialNumber":
        return asset.serialnumber || "";
      case "manufacturer":
        return (
          manufacturers.find((m) => m.manufacturerid === asset.manufacturerid)
            ?.manufacturername || ""
        );
      case "model":
        return models.find((m) => m.modelid === asset.modelid)?.modelname || "";
      case "location":
        return (
          locations.find((l) => l.locationid === asset.locationid)
            ?.locationname || ""
        );
      case "category":
        return (
          categories.find(
            (c) => c.assetcategorytypeid === asset.assetcategorytypeid,
          )?.assetcategorytypename || ""
        );
      case "purchaseDate":
        return asset.purchasedate
          ? new Date(asset.purchasedate).toLocaleDateString()
          : "";
      case "purchasePrice":
        return asset.purchaseprice || "";
      case "status":
        return asset.status || "";
      case "assignedTo":
        return asset.assignedto || "";
      default:
        return "";
    }
  };

  const buildAssetData = (asset: AssetData): Record<string, string> => {
    const qrCodeUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/assets/${asset.assetid}`;
    return {
      assetName: getFieldValue(asset, "assetName"),
      assetTag: getFieldValue(asset, "assetTag"),
      serialNumber: getFieldValue(asset, "serialNumber"),
      manufacturer: getFieldValue(asset, "manufacturer"),
      model: getFieldValue(asset, "model"),
      location: getFieldValue(asset, "location"),
      category: getFieldValue(asset, "category"),
      purchaseDate: getFieldValue(asset, "purchaseDate"),
      purchasePrice: getFieldValue(asset, "purchasePrice"),
      status: getFieldValue(asset, "status"),
      assignedTo: getFieldValue(asset, "assignedTo"),
      qrCodeUrl,
    };
  };

  const getTemplateFields = (template: LabelTemplate): string[] => {
    try {
      const parsed = JSON.parse(template.fields);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const handlePrint = () => {
    if (!printRef.current || !selectedTemplate) return;

    const widthIn = Number(selectedTemplate.width);
    const heightIn = Number(selectedTemplate.height);

    // Use a hidden iframe to avoid about:blank tab
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.top = "-10000px";
    iframe.style.left = "-10000px";
    iframe.style.width = "0";
    iframe.style.height = "0";
    document.body.appendChild(iframe);

    const doc = iframe.contentDocument;
    if (!doc) {
      document.body.removeChild(iframe);
      return;
    }

    const style = doc.createElement("style");
    style.textContent = [
      `@page { size: ${widthIn}in ${heightIn}in; margin: 0; }`,
      "body { margin: 0; padding: 0; font-family: Arial, sans-serif; }",
      `.label { width: ${widthIn}in; height: ${heightIn}in; padding: 0.15in; box-sizing: border-box; page-break-after: always; display: flex; gap: 0.1in; }`,
      ".label:last-child { page-break-after: auto; }",
      ".label-content { flex: 1; overflow: hidden; }",
      ".label-qr { flex-shrink: 0; display: flex; align-items: center; }",
      ".field { font-size: 8pt; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
      ".field-label { font-weight: bold; color: #333; }",
      ".field-value { color: #000; }",
      ".template-rendered { font-size: 8pt; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }",
    ].join("\n");
    doc.head.appendChild(style);

    const clonedContent = printRef.current.cloneNode(true);
    doc.body.appendChild(clonedContent);

    // Wait for content to render before printing
    setTimeout(() => {
      iframe.contentWindow?.print();
      setTimeout(() => document.body.removeChild(iframe), 1000);
    }, 100);
  };

  const handleDymoPrint = async () => {
    if (!selectedPrinter || assets.length === 0) return;
    setIsDymoPrinting(true);
    try {
      const size: DymoLabelSize =
        selectedDymoSize === "custom"
          ? {
              custom: {
                widthIn: Math.max(
                  0.5,
                  Math.min(8, parseFloat(customWidth) || 2.25),
                ),
                heightIn: Math.max(
                  0.5,
                  Math.min(8, parseFloat(customHeight) || 1.25),
                ),
              },
            }
          : {
              preset: selectedDymoSize as "30334" | "30252" | "30336" | "30321",
            };

      for (const asset of assets) {
        const data = buildAssetData(asset);
        const xml = buildDymoLabelXml(
          {
            assetId: asset.assetid,
            assetName: data.assetName,
            assetTag: data.assetTag,
            serialNumber: data.serialNumber,
            manufacturer: data.manufacturer,
            model: data.model,
            location: data.location,
            category: data.category,
            qrUrl: data.qrCodeUrl,
          },
          size,
        );
        printDymoLabel(xml, selectedPrinter);
      }
    } catch (err) {
      console.error("DYMO print error:", err);
    } finally {
      setIsDymoPrinting(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedTemplate || assets.length === 0) return;
    setIsDownloadingPdf(true);
    try {
      const res = await fetch("/api/labels/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetIds: assets.map((a) => a.assetid),
          templateId: selectedTemplate.id,
        }),
      });
      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `labels-${Date.now()}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("Failed to download PDF", err);
      toast.error("Failed to download PDF");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /** Render a single label using the programmable template layout */
  const renderTemplateLabel = (asset: AssetData, template: LabelTemplate) => {
    const data = buildAssetData(asset);
    const qrSize = Math.min(Number(template.height) * 72, 80);
    const qrCodeUrl = data.qrCodeUrl;

    // Check if the template references {{qrCode}} — we render it as a React component
    const layoutStr = template.layout;
    const hasQrPlaceholder = layoutStr.includes("{{qrCode}}");

    // Split around {{qrCode}} so we can inject the SVG component
    if (hasQrPlaceholder) {
      const parts = layoutStr.split("{{qrCode}}");
      const renderedParts = parts.map((part) =>
        renderLabelTemplate(part, data),
      );

      return (
        <div
          key={asset.assetid}
          className="label flex gap-3 rounded border bg-white p-3"
          style={{ maxWidth: `${Number(template.width) * 96}px` }}
        >
          <div className="label-content template-rendered min-w-0 flex-1 text-xs break-words whitespace-pre-wrap">
            {renderedParts.map((part, i) => (
              <React.Fragment key={i}>
                {part}
                {i < renderedParts.length - 1 && (
                  <span className="inline-block align-middle">
                    <QRCodeSVG value={qrCodeUrl} size={qrSize} />
                  </span>
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      );
    }

    // No {{qrCode}} placeholder — render text + optional QR on the side
    const rendered = renderLabelTemplate(layoutStr, data);
    return (
      <div
        key={asset.assetid}
        className="label flex gap-3 rounded border bg-white p-3"
        style={{ maxWidth: `${Number(template.width) * 96}px` }}
      >
        <div className="label-content template-rendered min-w-0 flex-1 text-xs break-words whitespace-pre-wrap">
          {rendered}
        </div>
        {template.includeQR && (
          <div className="label-qr flex-shrink-0">
            <QRCodeSVG value={qrCodeUrl} size={qrSize} />
          </div>
        )}
      </div>
    );
  };

  /** Render a single label using the legacy fields array approach */
  const renderFieldsLabel = (asset: AssetData, template: LabelTemplate) => {
    const fields = getTemplateFields(template);
    const qrSize = Math.min(Number(template.height) * 72, 80);
    return (
      <div
        key={asset.assetid}
        className="label flex gap-3 rounded border bg-white p-3"
        style={{ maxWidth: `${Number(template.width) * 96}px` }}
      >
        <div className="label-content min-w-0 flex-1">
          {fields.map((field) => {
            const value = getFieldValue(asset, field);
            if (!value) return null;
            return (
              <div key={field} className="field truncate text-xs">
                <span className="field-label text-muted-foreground">
                  {FIELD_LABELS[field] || field}:{" "}
                </span>
                <span className="field-value font-medium">{value}</span>
              </div>
            );
          })}
        </div>
        {template.includeQR && (
          <div className="label-qr flex-shrink-0">
            <QRCodeSVG
              value={`${typeof window !== "undefined" ? window.location.origin : ""}/assets/${asset.assetid}`}
              size={qrSize}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Print Labels</DialogTitle>
          <DialogDescription>
            {assets.length} asset{assets.length !== 1 ? "s" : ""} selected for
            label printing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {templates.length === 0 ? (
            <div className="text-muted-foreground py-6 text-center">
              <p>No label templates configured.</p>
              <p className="mt-1 text-sm">
                Create templates in Admin Settings &gt; Labels.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="label-template-select"
                  className="mb-1.5 block text-sm font-medium"
                >
                  Template
                </label>
                <Select
                  value={selectedTemplateId}
                  onValueChange={setSelectedTemplateId}
                >
                  <SelectTrigger id="label-template-select">
                    <SelectValue placeholder="Select a template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name} ({Number(t.width)}&quot; x {Number(t.height)}
                        &quot;)
                        {t.isDefault ? " (Default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedTemplate && (
                <div className="bg-muted/30 rounded-lg border p-4">
                  <p className="mb-3 text-sm font-medium">Preview</p>
                  <div ref={printRef} className="space-y-3">
                    {assets.map((asset) => {
                      if (isTemplateString(selectedTemplate.layout)) {
                        return renderTemplateLabel(asset, selectedTemplate);
                      }
                      return renderFieldsLabel(asset, selectedTemplate);
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* DYMO direct print section */}
        <div className="space-y-3 border-t pt-4">
          <p className="text-sm font-medium">Print directly to DYMO</p>

          {dymo.isLoading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting DYMO printers…
            </div>
          ) : dymo.error || !dymo.isAvailable ? (
            <p className="text-muted-foreground text-sm">
              No DYMO printer detected.{" "}
              <a
                href="https://www.dymo.com/support/dymo-connect-for-desktop-support.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Install DYMO Connect
              </a>{" "}
              to print directly.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="dymo-printer-select"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Printer
                  </label>
                  <Select
                    value={selectedPrinter}
                    onValueChange={setSelectedPrinter}
                  >
                    <SelectTrigger id="dymo-printer-select">
                      <SelectValue placeholder="Select printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {dymo.printers.map((p) => (
                        <SelectItem key={p.name} value={p.name}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label
                    htmlFor="dymo-label-size-select"
                    className="mb-1.5 block text-sm font-medium"
                  >
                    Label size
                  </label>
                  <Select
                    value={selectedDymoSize}
                    onValueChange={setSelectedDymoSize}
                  >
                    <SelectTrigger id="dymo-label-size-select">
                      <SelectValue placeholder="Select label size" />
                    </SelectTrigger>
                    <SelectContent>
                      {DYMO_LABEL_SIZES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                      <SelectItem value="custom">Custom…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedDymoSize === "custom" && (
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <label
                      htmlFor="custom-label-width"
                      className="text-muted-foreground mb-1 block text-xs"
                    >
                      Width (in)
                    </label>
                    <Input
                      id="custom-label-width"
                      type="number"
                      min="0.5"
                      max="8"
                      step="0.125"
                      value={customWidth}
                      onChange={(e) => setCustomWidth(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <span className="text-muted-foreground mt-5">×</span>
                  <div className="flex-1">
                    <label
                      htmlFor="custom-label-height"
                      className="text-muted-foreground mb-1 block text-xs"
                    >
                      Height (in)
                    </label>
                    <Input
                      id="custom-label-height"
                      type="number"
                      min="0.5"
                      max="8"
                      step="0.125"
                      value={customHeight}
                      onChange={(e) => setCustomHeight(e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={
              !selectedTemplate || assets.length === 0 || isDownloadingPdf
            }
          >
            {isDownloadingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            PDF
          </Button>
          <Button
            variant="outline"
            onClick={handlePrint}
            disabled={!selectedTemplate || assets.length === 0}
          >
            <Printer className="mr-2 h-4 w-4" />
            Browser Print
          </Button>
          <Button
            onClick={handleDymoPrint}
            disabled={
              !dymo.isAvailable ||
              !selectedPrinter ||
              assets.length === 0 ||
              isDymoPrinting
            }
          >
            {isDymoPrinting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-2 h-4 w-4" />
            )}
            DYMO Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
