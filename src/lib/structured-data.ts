import { getCanonicalUrl, type FaqItem } from "@/lib/seo";

export function getSoftwareApplicationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Asset Tracker",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: getCanonicalUrl("/"),
    description:
      "IT asset management software to track hardware, software licenses, and consumables across your organization.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free Starter plan with up to 250 assets and 5 users",
    },
    featureList: [
      "Hardware asset tracking",
      "Software license management",
      "Maintenance scheduling",
      "Role-based access control",
      "Reports and analytics",
      "Multi-tenant support",
      "CSV import and export",
      "Check-in and check-out",
      "Audit history",
      "SSO integration",
    ],
  };
}

export function getOrganizationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Asset Tracker",
    url: getCanonicalUrl("/"),
    logo: `${getCanonicalUrl("/")}/icons/icon.svg`,
  };
}

export function getFaqSchema(items: FaqItem[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function getBreadcrumbSchema(
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: getCanonicalUrl(item.path),
    })),
  };
}
