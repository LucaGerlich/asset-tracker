"use client";

import React, { useState, useCallback } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Star, X } from "lucide-react";

interface GalleryImage {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  thumbnailPath: string | null;
  isPrimary: boolean;
}

interface AssetPhotoGalleryProps {
  images: GalleryImage[];
  onSetPrimary?: (id: string) => void;
  readOnly?: boolean;
}

export default function AssetPhotoGallery({
  images,
  onSetPrimary,
  readOnly = false,
}: AssetPhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((index: number) => {
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxIndex(null);
  }, []);

  const goNext = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev + 1) % images.length : null,
    );
  }, [images.length]);

  const goPrev = useCallback(() => {
    setLightboxIndex((prev) =>
      prev !== null ? (prev - 1 + images.length) % images.length : null,
    );
  }, [images.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    },
    [goNext, goPrev],
  );

  if (images.length === 0) return null;

  const currentImage = lightboxIndex !== null ? images[lightboxIndex] : null;

  return (
    <>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, index) => (
          <Button
            key={img.id}
            type="button"
            variant="ghost"
            className="border-default-200 hover:border-primary group bg-muted relative aspect-square h-auto cursor-pointer overflow-hidden rounded-lg border p-0 transition-colors"
            onClick={() => openLightbox(index)}
          >
            <img
              src={`${img.path}?thumb=gallery`}
              alt={img.originalName}
              className="h-full w-full object-cover"
              loading="lazy"
            />
            {img.isPrimary && (
              <div className="absolute top-1 left-1 rounded-full bg-yellow-500 p-0.5 text-white">
                <Star className="h-3 w-3 fill-white" />
              </div>
            )}
            {!readOnly && onSetPrimary && !img.isPrimary && (
              <div className="absolute top-1 right-1 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="secondary"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetPrimary(img.id);
                  }}
                  title="Set as primary photo"
                >
                  <Star className="h-3 w-3" />
                </Button>
              </div>
            )}
          </Button>
        ))}
      </div>

      <Dialog open={lightboxIndex !== null} onOpenChange={closeLightbox}>
        <DialogContent
          className="max-h-[90vh] max-w-[90vw] overflow-hidden border-0 bg-black/95 p-0"
          onKeyDown={handleKeyDown}
        >
          <div className="relative flex h-[85vh] w-full items-center justify-center">
            {/* Close button */}
            <Button
              size="icon"
              variant="ghost"
              className="absolute top-2 right-2 z-10 text-white hover:bg-white/20"
              onClick={closeLightbox}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Navigation arrows */}
            {images.length > 1 && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute left-2 z-10 h-10 w-10 text-white hover:bg-white/20"
                  onClick={goPrev}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 z-10 h-10 w-10 text-white hover:bg-white/20"
                  onClick={goNext}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </>
            )}

            {currentImage && (
              <img
                src={currentImage.path}
                alt={currentImage.originalName}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>

          {/* Caption bar */}
          {currentImage && (
            <div className="absolute right-0 bottom-0 left-0 flex items-center gap-2 bg-black/70 px-4 py-2 text-sm text-white">
              {currentImage.isPrimary && (
                <Star className="h-3.5 w-3.5 flex-shrink-0 fill-yellow-500 text-yellow-500" />
              )}
              <span className="truncate">{currentImage.originalName}</span>
              <span className="ml-auto flex-shrink-0 text-white/60">
                {lightboxIndex !== null ? lightboxIndex + 1 : 0} /{" "}
                {images.length}
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
