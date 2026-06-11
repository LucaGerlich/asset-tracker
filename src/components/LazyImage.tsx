"use client";

import Image from "next/image";
import { useState } from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  /** Classes applied to the <Image> (e.g. object-cover/object-contain). */
  className?: string;
  /** Responsive sizes hint for the browser. */
  sizes?: string;
  /** Eager-load above-the-fold images; otherwise they lazy-load. */
  priority?: boolean;
}

/**
 * Fills its (positioned) parent with a lazily-loaded image. Shows an animated
 * skeleton while the bytes arrive, then fades the image in on load. The parent
 * must be `position: relative` and have a defined size.
 */
export function LazyImage({
  src,
  alt,
  className = "object-cover",
  sizes,
  priority = false,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <>
      {!loaded && !errored && (
        <div
          className="bg-default-200 absolute inset-0 animate-pulse"
          aria-hidden="true"
        />
      )}
      {!errored && (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes={sizes}
          priority={priority}
          loading={priority ? undefined : "lazy"}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`${className} transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        />
      )}
    </>
  );
}
