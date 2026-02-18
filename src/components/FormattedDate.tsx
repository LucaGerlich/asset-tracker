"use client";

import React from "react";
import { formatDate, formatRelativeTime } from "@/lib/formatting";

interface FormattedDateProps {
  /** A Date object or ISO date string. */
  date: Date | string;
  /** Formatting style. "relative" renders a human-readable relative time. */
  style?: "short" | "medium" | "long" | "relative";
  /** Optional CSS class name for the wrapping element. */
  className?: string;
}

/**
 * Renders a formatted date with a `title` attribute showing the full ISO
 * timestamp on hover. Supports short, medium, long, and relative styles.
 */
export default function FormattedDate({
  date,
  style = "medium",
  className,
}: FormattedDateProps) {
  const d = typeof date === "string" ? new Date(date) : date;
  const isoString = d.toISOString();

  const formatted =
    style === "relative" ? formatRelativeTime(date) : formatDate(date, style);

  return (
    <time dateTime={isoString} title={isoString} className={className}>
      {formatted}
    </time>
  );
}
