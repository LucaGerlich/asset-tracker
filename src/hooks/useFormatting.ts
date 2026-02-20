"use client";

import { useMemo } from "react";
import { useUserPreferences } from "@/contexts/UserPreferencesContext";

const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  nl: "nl-NL",
};

const DATE_FORMAT_MAP: Record<string, Intl.DateTimeFormatOptions> = {
  "MM/DD/YYYY": { month: "2-digit", day: "2-digit", year: "numeric" },
  "DD/MM/YYYY": { day: "2-digit", month: "2-digit", year: "numeric" },
  "YYYY-MM-DD": { year: "numeric", month: "2-digit", day: "2-digit" },
};

const RELATIVE_TIME_UNITS: { unit: Intl.RelativeTimeFormatUnit; ms: number }[] =
  [
    { unit: "year", ms: 365.25 * 24 * 60 * 60 * 1000 },
    { unit: "month", ms: 30.44 * 24 * 60 * 60 * 1000 },
    { unit: "week", ms: 7 * 24 * 60 * 60 * 1000 },
    { unit: "day", ms: 24 * 60 * 60 * 1000 },
    { unit: "hour", ms: 60 * 60 * 1000 },
    { unit: "minute", ms: 60 * 1000 },
    { unit: "second", ms: 1000 },
  ];

export function useFormatting() {
  const { preferences } = useUserPreferences();

  const intlLocale = LOCALE_MAP[preferences.locale] || "en-US";
  const timezone = preferences.timezone || "UTC";
  const dateFormatOptions =
    DATE_FORMAT_MAP[preferences.dateFormat] || DATE_FORMAT_MAP["MM/DD/YYYY"];

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(intlLocale, {
        ...dateFormatOptions,
        timeZone: timezone,
      }),
    [intlLocale, dateFormatOptions, timezone],
  );

  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(intlLocale, {
        style: "currency",
        currency: preferences.currency || "USD",
      }),
    [intlLocale, preferences.currency],
  );

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(intlLocale),
    [intlLocale],
  );

  const relativeTimeFormatter = useMemo(
    () => new Intl.RelativeTimeFormat(intlLocale, { numeric: "auto" }),
    [intlLocale],
  );

  function formatDate(
    date: Date | string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "Invalid date";

    if (options) {
      const customFormatter = new Intl.DateTimeFormat(intlLocale, {
        ...options,
        timeZone: timezone,
      });
      return customFormatter.format(d);
    }

    return dateFormatter.format(d);
  }

  function formatCurrency(amount: number): string {
    return currencyFormatter.format(amount);
  }

  function formatNumber(value: number): string {
    return numberFormatter.format(value);
  }

  function formatRelativeTime(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "Invalid date";

    const diffMs = d.getTime() - Date.now();
    const absDiff = Math.abs(diffMs);

    for (const { unit, ms } of RELATIVE_TIME_UNITS) {
      if (absDiff >= ms || unit === "second") {
        const value = Math.round(diffMs / ms);
        return relativeTimeFormatter.format(value, unit);
      }
    }

    return relativeTimeFormatter.format(0, "second");
  }

  return {
    formatDate,
    formatCurrency,
    formatNumber,
    formatRelativeTime,
  };
}
