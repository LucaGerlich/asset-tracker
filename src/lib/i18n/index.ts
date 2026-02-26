/**
 * Lightweight i18n system for the Asset Tracker application.
 *
 * No external packages required. Supports parameter interpolation
 * with {{param}} syntax, locale switching, and key-based fallback.
 *
 * Usage:
 *   import { t, setLocale, getLocale } from "@/lib/i18n";
 *   t("nav.dashboard");                        // "Dashboard"
 *   t("greeting", { name: "Luca" });            // "Hello, Luca"
 *   t("some.missing.key");                       // "some.missing.key"
 */

import en from "./locales/en";
import de from "./locales/de";
import fr from "./locales/fr";
import es from "./locales/es";
import nl from "./locales/nl";

// ---------------------------------------------------------------------------
// Translation store
// ---------------------------------------------------------------------------

type Translations = Record<string, string>;

const translationStore: Record<string, Translations> = {
  en,
  de,
  fr,
  es,
  nl,
};

/** Available locale codes and their display names */
export const AVAILABLE_LOCALES = {
  en: "English",
  de: "Deutsch",
  fr: "Fran\u00e7ais",
  es: "Espa\u00f1ol",
  nl: "Nederlands",
} as const;

export type LocaleCode = keyof typeof AVAILABLE_LOCALES;

let currentLocale = "en";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Set the active locale. If the locale has no registered translations the
 * call is still accepted (strings will fall back to their keys until
 * translations are loaded via `registerLocale`).
 */
export function setLocale(locale: string): void {
  currentLocale = locale;
}

/**
 * Return the currently active locale code (e.g. "en").
 */
export function getLocale(): string {
  return currentLocale;
}

/**
 * Register (or replace) translations for a given locale at runtime.
 * This allows lazy-loading additional languages without bundling them
 * upfront.
 */
export function registerLocale(locale: string, translations: Translations): void {
  translationStore[locale] = { ...translationStore[locale], ...translations };
}

/**
 * Translate a key using the current locale.
 *
 * Supports parameter interpolation with double-brace syntax:
 *   t("greeting", { name: "Luca" })
 *   // given "greeting": "Hello, {{name}}"  ->  "Hello, Luca"
 *
 * Falls back to the English translation when the key is missing in the
 * current locale, and finally to the raw key itself.
 */
export function t(key: string, params?: Record<string, string>): string {
  const localeStrings = translationStore[currentLocale];
  let value = localeStrings?.[key];

  // Fallback to English if the current locale does not have the key
  if (value === undefined && currentLocale !== "en") {
    value = translationStore.en?.[key];
  }

  // Fallback to the raw key
  if (value === undefined) {
    value = key;
  }

  // Interpolate parameters: replace every {{param}} with the supplied value
  if (params) {
    value = value.replace(/\{\{(\w+)\}\}/g, (_match, paramKey) => {
      return params[paramKey] !== undefined ? params[paramKey] : `{{${paramKey}}}`;
    });
  }

  return value;
}
