/**
 * Regional formatting utilities for dates, numbers, and currencies.
 *
 * All functions respect the user's locale (via the i18n module) and accept
 * an optional `locale` override. Internally they delegate to the `Intl` API
 * so formatting automatically adapts to any supported BCP 47 language tag.
 */

import { getLocale } from "@/lib/i18n";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolveLocale(locale?: string): string {
  return locale ?? getLocale();
}

function toDate(date: Date | string): Date {
  return typeof date === "string" ? new Date(date) : date;
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

/**
 * Format a date value according to the active (or supplied) locale.
 *
 * Styles:
 *  - "short"  : 02/18/2026       (numeric)
 *  - "medium" : Feb 18, 2026     (abbreviated month)
 *  - "long"   : February 18, 2026 (full month name)
 *
 * @param date   A Date object or ISO string.
 * @param style  Formatting preset. Defaults to "medium".
 * @param locale BCP 47 locale override.
 */
export function formatDate(
  date: Date | string,
  style: "short" | "medium" | "long" = "medium",
  locale?: string,
): string {
  const d = toDate(date);
  const loc = resolveLocale(locale);

  const optionsMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { year: "numeric", month: "2-digit", day: "2-digit" },
    medium: { year: "numeric", month: "short", day: "numeric" },
    long: { year: "numeric", month: "long", day: "numeric" },
  };

  return new Intl.DateTimeFormat(loc, optionsMap[style]).format(d);
}

// ---------------------------------------------------------------------------
// Number formatting
// ---------------------------------------------------------------------------

/**
 * Format a number with locale-aware grouping and decimal separators.
 *
 * @param value    The number to format.
 * @param decimals Fixed number of fraction digits. When omitted the browser
 *                 default is used (typically 0-3 depending on value).
 * @param locale   BCP 47 locale override.
 */
export function formatNumber(
  value: number,
  decimals?: number,
  locale?: string,
): string {
  const loc = resolveLocale(locale);
  const options: Intl.NumberFormatOptions = {};

  if (decimals !== undefined) {
    options.minimumFractionDigits = decimals;
    options.maximumFractionDigits = decimals;
  }

  return new Intl.NumberFormat(loc, options).format(value);
}

// ---------------------------------------------------------------------------
// Currency formatting
// ---------------------------------------------------------------------------

/**
 * Format a monetary value with the appropriate currency symbol and locale
 * conventions.
 *
 * @param value    The monetary amount.
 * @param currency ISO 4217 currency code. Defaults to "USD".
 * @param locale   BCP 47 locale override.
 */
export function formatCurrency(
  value: number,
  currency: string = "USD",
  locale?: string,
): string {
  const loc = resolveLocale(locale);

  return new Intl.NumberFormat(loc, {
    style: "currency",
    currency,
  }).format(value);
}

// ---------------------------------------------------------------------------
// Relative time formatting
// ---------------------------------------------------------------------------

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

interface RelativeUnit {
  threshold: number;
  unit: Intl.RelativeTimeFormatUnit;
  divisor: number;
}

const RELATIVE_UNITS: RelativeUnit[] = [
  { threshold: MINUTE, unit: "second", divisor: SECOND },
  { threshold: HOUR, unit: "minute", divisor: MINUTE },
  { threshold: DAY, unit: "hour", divisor: HOUR },
  { threshold: WEEK, unit: "day", divisor: DAY },
  { threshold: MONTH, unit: "week", divisor: WEEK },
  { threshold: YEAR, unit: "month", divisor: MONTH },
  { threshold: Infinity, unit: "year", divisor: YEAR },
];

/**
 * Return a human-readable relative time string such as "just now",
 * "5 minutes ago", "2 hours ago", "yesterday", or "3 days ago".
 *
 * Uses `Intl.RelativeTimeFormat` when available and falls back to a
 * simple English approximation otherwise.
 *
 * @param date   A Date object or ISO string.
 * @param locale BCP 47 locale override.
 */
export function formatRelativeTime(
  date: Date | string,
  locale?: string,
): string {
  const d = toDate(date);
  const now = Date.now();
  const diffMs = d.getTime() - now; // negative means in the past
  const absDiff = Math.abs(diffMs);

  // "just now" threshold: less than 10 seconds
  if (absDiff < 10 * SECOND) {
    return "just now";
  }

  // Find the appropriate unit
  const matched = RELATIVE_UNITS.find((u) => absDiff < u.threshold);
  if (!matched) {
    // Should never happen given Infinity, but fall back to date string
    return formatDate(date, "medium", locale);
  }

  const value = Math.round(diffMs / matched.divisor);

  // Try Intl.RelativeTimeFormat (widely supported in modern browsers / Node 12+)
  if (typeof Intl !== "undefined" && Intl.RelativeTimeFormat) {
    const loc = resolveLocale(locale);
    try {
      const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
      return rtf.format(value, matched.unit);
    } catch {
      // Fall through to manual fallback
    }
  }

  // Manual English fallback
  return manualRelativeFallback(value, matched.unit);
}

/**
 * Simple English-only fallback for relative time when Intl is unavailable.
 */
function manualRelativeFallback(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
): string {
  const absValue = Math.abs(value);
  const isFuture = value > 0;

  // Special cases for "1" values
  if (absValue === 1) {
    const special: Record<string, [string, string]> = {
      day: ["yesterday", "tomorrow"],
      hour: ["1 hour ago", "in 1 hour"],
      minute: ["1 minute ago", "in 1 minute"],
      second: ["1 second ago", "in 1 second"],
      week: ["last week", "next week"],
      month: ["last month", "next month"],
      year: ["last year", "next year"],
    };
    const pair = special[unit];
    if (pair) {
      return isFuture ? pair[1] : pair[0];
    }
  }

  const plural = absValue === 1 ? unit : `${unit}s`;
  return isFuture ? `in ${absValue} ${plural}` : `${absValue} ${plural} ago`;
}
