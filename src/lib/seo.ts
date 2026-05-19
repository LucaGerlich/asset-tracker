import type { Metadata } from "next";
import { getBaseUrl } from "@/lib/url";

export const SITE_CONFIG = {
  siteName: "Asset Tracker",
  defaultTitle: "Asset Tracker — IT Asset Management Software",
  titleTemplate: "%s | Asset Tracker",
  description:
    "Track, manage, and optimize hardware, software licenses, and consumables with Asset Tracker. Free IT asset management platform built for modern teams.",
  locale: "en_US",
} as const;

export function getCanonicalUrl(path: string): string {
  const base = getBaseUrl().replace(/\/$/, "");
  const cleanPath = path === "/" ? "" : path.replace(/\/$/, "");
  return `${base}${cleanPath}`;
}

interface PageMetadataOptions {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}

export function createPageMetadata({
  title,
  description,
  path,
  noIndex,
}: PageMetadataOptions): Metadata {
  const canonicalUrl = getCanonicalUrl(path);

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: SITE_CONFIG.siteName,
      locale: SITE_CONFIG.locale,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    ...(noIndex && {
      robots: { index: false, follow: false },
    }),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export const LANDING_FAQ: FaqItem[] = [
  {
    question: "What is IT asset management software?",
    answer:
      "IT asset management (ITAM) software helps organizations track, manage, and optimize their technology assets throughout the entire lifecycle — from procurement to disposal. This includes hardware like laptops and servers, software licenses, consumables, and accessories. Asset Tracker provides a centralized platform to maintain full visibility and control over every asset your team relies on.",
  },
  {
    question: "How does Asset Tracker help manage software licenses?",
    answer:
      "Asset Tracker monitors all your software licenses in one place, tracking license counts, expiration dates, and compliance status. You receive automated alerts before licenses expire, helping you avoid costly lapses or over-licensing. The platform supports per-seat, per-device, and enterprise license models so you can manage compliance across your entire organization.",
  },
  {
    question: "Can I track hardware assets across multiple locations?",
    answer:
      "Yes. Asset Tracker supports multi-location tracking with a built-in location hierarchy. You can assign assets to specific sites, buildings, floors, or rooms and track movements with full audit history. The check-in and check-out system records every assignment change, giving you complete visibility into where each asset is at any time.",
  },
  {
    question: "Is Asset Tracker free for small teams?",
    answer:
      "Yes. The Starter plan is completely free and includes up to 250 assets, 5 users, and all core features including asset tracking, license management, and maintenance scheduling. No credit card is required to get started. As your team grows, you can upgrade to Professional or Enterprise plans for higher limits and advanced features like SSO, custom workflows, and priority support.",
  },
  {
    question: "Can I self-host Asset Tracker?",
    answer:
      "Yes. Asset Tracker is open source under the MIT license and designed for self-hosting. You can deploy it on your own infrastructure using Docker, with full control over your data. Self-hosting is ideal for organizations with strict data residency requirements or those who prefer to manage their own infrastructure.",
  },
  {
    question: "What types of assets can I track?",
    answer:
      "Asset Tracker supports six asset types out of the box: hardware assets (laptops, desktops, servers, monitors), software licenses, consumables (toner, cables, batteries), accessories (keyboards, mice, headsets), components (RAM, SSDs, GPUs), and asset kits (bundled sets of items). Each type has dedicated fields, categories, and workflows tailored to its lifecycle.",
  },
];
