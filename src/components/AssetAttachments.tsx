"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Star, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { FileDropZone } from "@/components/FileDropZone";
import AssetPhotoGallery from "@/components/AssetPhotoGallery";

interface Attachment {
  id: string;
  assetId: string;
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

interface AssetAttachmentsProps {
  assetId: string;
  readOnly?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AssetAttachments({
  assetId,
  readOnly = false,
}: AssetAttachmentsProps) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = useCallback(async () => {
    try {
      const res = await fetch(`/api/asset/attachments?assetId=${assetId}`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch {
      /* attachment fetch failure is non-critical */
    }
  }, [assetId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const uploadFile = useCallback(
    async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("assetId", assetId);

      const res = await fetch("/api/asset/attachments", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Upload failed");
      }

      return file.name;
    },
    [assetId],
  );

  const handleFilesSelected = useCallback(
    async (files: File[]) => {
      setUploading(true);
      try {
        for (const file of files) {
          await uploadFile(file);
          toast.success("File uploaded", { description: file.name });
        }
        fetchAttachments();
      } catch (err) {
        toast.error("Upload failed", { description: (err as Error).message });
      } finally {
        setUploading(false);
      }
    },
    [uploadFile, fetchAttachments],
  );

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/asset/attachments/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Attachment deleted");
      setAttachments((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to delete attachment", err);
      toast.error("Failed to delete attachment");
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      const res = await fetch(`/api/asset/attachments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrimary: true }),
      });
      if (!res.ok) throw new Error("Failed to set primary");
      fetchAttachments();
    } catch (err) {
      console.error("Failed to set as primary", err);
      toast.error("Failed to set as primary");
    }
  };

  const isImage = (mimeType: string) => mimeType.startsWith("image/");

  const { images, documents } = useMemo(() => {
    const imgs: Attachment[] = [];
    const docs: Attachment[] = [];
    for (const att of attachments) {
      if (isImage(att.mimeType)) imgs.push(att);
      else docs.push(att);
    }
    return { images: imgs, documents: docs };
  }, [attachments]);

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-foreground-600 text-sm font-semibold">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h2>
        {uploading && (
          <span className="text-muted-foreground text-xs">Uploading...</span>
        )}
      </div>

      {!readOnly && (
        <FileDropZone
          onFilesSelected={handleFilesSelected}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
          multiple
          uploading={uploading}
          label="Drag & drop files here, or click to browse"
        />
      )}

      {attachments.length === 0 ? (
        <p className="text-foreground-500 mt-3 text-sm">No attachments.</p>
      ) : (
        <>
          {images.length > 0 && (
            <div className="mt-3">
              <AssetPhotoGallery
                images={images}
                onSetPrimary={readOnly ? undefined : handleSetPrimary}
                readOnly={readOnly}
              />
            </div>
          )}

          {documents.length > 0 && (
            <div className="space-y-2">
              {documents.map((att) => (
                <div
                  key={att.id}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded p-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <Paperclip className="text-foreground-400 h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0">
                      <a
                        href={att.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary block truncate font-medium hover:underline"
                      >
                        {att.originalName}
                      </a>
                      <span className="text-foreground-500 text-xs">
                        {formatFileSize(att.size)}
                        {att.user &&
                          ` • ${att.user.firstname} ${att.user.lastname}`}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {!readOnly && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive h-7 w-7"
                        onClick={() => handleDelete(att.id, att.originalName)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Image list (for delete access) */}
          {images.length > 0 && !readOnly && (
            <div className="mt-2 space-y-1">
              {images.map((att) => (
                <div
                  key={att.id}
                  className="hover:bg-muted/50 flex items-center justify-between gap-2 rounded p-1 px-2 text-sm"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <ImageIcon className="h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                    <span className="text-foreground-500 truncate text-xs">
                      {att.originalName}
                    </span>
                    {att.isPrimary && (
                      <Star className="h-3 w-3 flex-shrink-0 fill-yellow-500 text-yellow-500" />
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
