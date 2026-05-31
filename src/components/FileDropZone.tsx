"use client";

import React, { useRef, useState, useCallback } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxSizeMb?: number;
  uploading?: boolean;
  label?: string;
}

export function FileDropZone({
  onFilesSelected,
  accept,
  multiple = false,
  maxSizeMb = 10,
  uploading = false,
  label = "Drag & drop files here, or click to browse",
}: FileDropZoneProps) {
  const [dragging, setDragging] = useState(false);
  const dragCounter = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const acceptedTypes = accept
    ? accept.split(",").map((t) => t.trim().toLowerCase())
    : null;

  const validateFile = useCallback(
    (file: File): boolean => {
      if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
        toast.error(`File too large: ${file.name}`, {
          description: `Max size is ${maxSizeMb} MB`,
        });
        return false;
      }

      if (acceptedTypes) {
        const ext = "." + file.name.split(".").pop()?.toLowerCase();
        const mime = file.type.toLowerCase();
        const matches = acceptedTypes.some((t) => {
          if (t.startsWith(".")) return ext === t;
          if (t.endsWith("/*")) return mime.startsWith(t.replace("/*", "/"));
          return mime === t;
        });
        if (!matches) {
          toast.error(`File type not accepted: ${file.name}`, {
            description: `Accepted: ${accept}`,
          });
          return false;
        }
      }

      return true;
    },
    [maxSizeMb, acceptedTypes, accept],
  );

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      const files = Array.from(fileList);
      const valid = files.filter(validateFile);
      if (valid.length > 0) {
        onFilesSelected(multiple ? valid : [valid[0]]);
      }
    },
    [validateFile, onFilesSelected, multiple],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) setDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFiles(e.target.files);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFiles],
  );

  return (
    <button
      type="button"
      tabIndex={0}
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          if (!uploading) inputRef.current?.click();
        }
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"} ${uploading ? "pointer-events-none opacity-60" : ""} `}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        aria-label={label}
      />
      <UploadCloud
        className={`h-8 w-8 ${dragging ? "text-primary" : "text-muted-foreground"}`}
      />
      <p className="text-muted-foreground text-center text-sm">{label}</p>
      {uploading && (
        <div className="absolute right-0 bottom-0 left-0 h-1 overflow-hidden rounded-b-lg">
          <div className="bg-primary/30 h-full w-full animate-pulse" />
        </div>
      )}
    </button>
  );
}
