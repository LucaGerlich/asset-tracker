"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Star, HardDrive } from "lucide-react";
import { toast } from "sonner";
import { FileDropZone } from "@/components/FileDropZone";
import AssetPhotoGallery from "@/components/AssetPhotoGallery";
import Link from "next/link";

type EntityType = "accessory" | "consumable" | "component";

interface Attachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  thumbnailPath: string | null;
  isPrimary: boolean;
  createdAt: string;
  user?: { userid: string; firstname: string; lastname: string } | null;
}

interface EntityAttachmentsProps {
  entityType: EntityType;
  entityId: string;
  readOnly?: boolean;
}

export default function EntityAttachments({
  entityType,
  entityId,
  readOnly = false,
}: EntityAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [storageNotConfigured, setStorageNotConfigured] = useState(false);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/attachments?entityType=${entityType}&entityId=${entityId}`,
      );
      if (res.ok) {
        const data = (await res.json()) as Attachment[];
        setAttachments(data);
      }
    } catch {
      // attachment fetch failure is non-critical
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        for (const file of files) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("entityType", entityType);
          formData.append("entityId", entityId);

          const res = await fetch("/api/attachments", {
            method: "POST",
            body: formData,
          });

          if (res.status === 503) {
            const data = (await res.json()) as {
              storageNotConfigured?: boolean;
            };
            if (data.storageNotConfigured) {
              setStorageNotConfigured(true);
              toast.error("Storage not configured", {
                description:
                  "An admin needs to configure object storage first.",
              });
              return;
            }
          }

          if (!res.ok) {
            const err = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(err.error ?? "Upload failed");
          }

          toast.success("Image uploaded", { description: file.name });
        }
        fetchAttachments();
      } catch (err) {
        toast.error("Upload failed", { description: (err as Error).message });
      } finally {
        setUploading(false);
      }
    },
    [entityType, entityId, fetchAttachments],
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(
        `/api/attachments/${id}?entityType=${entityType}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Image deleted");
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await fetch(`/api/attachments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true, entityType }),
      });
      if (!res.ok) throw new Error("Failed to set primary");
      fetchAttachments();
    } catch {
      toast.error("Failed to set as primary image");
    }
  };

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-foreground-600 text-sm font-semibold">
          Photos {attachments.length > 0 && `(${attachments.length})`}
        </h2>
        {uploading && (
          <span className="text-muted-foreground text-xs">Uploading…</span>
        )}
      </div>

      {storageNotConfigured ? (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="font-medium text-amber-800 dark:text-amber-200">
              Storage not configured
            </p>
            <p className="text-amber-700 dark:text-amber-300">
              Configure an object storage bucket in{" "}
              <Link href="/admin/settings?tab=storage" className="underline">
                Admin → Settings → Storage
              </Link>{" "}
              to enable image uploads.
            </p>
          </div>
        </div>
      ) : (
        !readOnly && (
          <FileDropZone
            onFilesSelected={handleFilesSelected}
            accept="image/*"
            multiple
            uploading={uploading}
            label="Drag & drop images here, or click to browse"
          />
        )
      )}

      {attachments.length === 0 ? (
        <p className="text-foreground-500 mt-3 text-sm">No photos yet.</p>
      ) : (
        <>
          <div className="mt-3">
            <AssetPhotoGallery
              images={attachments}
              onSetPrimary={readOnly ? undefined : handleSetPrimary}
              readOnly={readOnly}
            />
          </div>

          {!readOnly && (
            <div className="mt-2 space-y-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded p-1 px-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="text-foreground-500 truncate text-xs">
                      {att.originalName}
                    </span>
                    {att.isPrimary && (
                      <Star className="h-3 w-3 shrink-0 fill-yellow-500 text-yellow-500" />
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive h-6 w-6"
                    onClick={() => handleDelete(att.id, att.originalName)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
