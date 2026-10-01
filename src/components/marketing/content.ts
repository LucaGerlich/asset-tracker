// All marketing copy in one place. Spec footers reference real routes/crons;
// re-verify them if the referenced code moves.

export const MARKETING_LINKS = {
  github: "https://github.com/LucaGerlich/asset-tracker",
  register: "/register",
  login: "/login",
  pricing: "/pricing",
  features: "/#features",
  terms: "/terms",
  privacy: "/privacy",
} as const;

export const HERO = {
  eyebrow: "OPEN SOURCE · MIT · SELF-HOSTABLE",
  title: "Every asset, accounted for.",
  sub: "IT asset management software for teams that track hardware, licenses, consumables and maintenance. One inventory, one audit trail, no spreadsheets.",
  primaryCta: "Start free",
  command: "docker compose --profile with-db up -d",
} as const;

export const FACTS = [
  "SSO · OIDC · SAML",
  "SCIM 2.0 provisioning",
  "MFA / TOTP",
  "EU-hosted or self-hosted",
] as const;

export const FEATURES = {
  eyebrow: "FEATURES",
  title: "One inventory, every workflow.",
  sub: "Drawn like a schematic, because that's how it's built.",
} as const;

export interface FeatureCellCopy {
  label: string;
  meta: string;
  title: string;
  description: string;
  footer: string;
}

export const FEATURE_CELLS = {
  checkout: {
    label: "checkout",
    meta: "AT-00412",
    title: "Check-out & check-in",
    description:
      "Assign assets to people or locations with due dates and a full return flow.",
    footer: "POST /api/asset/checkout",
  },
  licenses: {
    label: "license_seats",
    meta: "figma · 18/20",
    title: "License compliance",
    description:
      "Seats, expiry dates and cost per license, with alerts before anything expires.",
    footer: "cron · notifications · daily",
  },
  lifecycle: {
    label: "lifecycle",
    meta: "status transitions",
    title: "Full lifecycle",
    description:
      "From purchase to disposal, with custom statuses and allowed transitions.",
    footer: "GET /api/status-transitions",
  },
  identity: {
    label: "identity",
    meta: "SCIM 2.0",
    title: "SSO & SCIM provisioning",
    description:
      "Sign in with your identity provider. Users are created and deactivated automatically.",
    footer: "OIDC · SAML · /api/scim/v2",
  },
  consumables: {
    label: "consumables",
    meta: "stock",
    title: "Consumables & stock",
    description:
      "Minimum quantities and stock alerts, so you reorder before you run out.",
    footer: "GET /api/stock-alerts",
  },
  audit: {
    label: "audit_log",
    meta: "tail -f",
    title: "Audit trail with revert",
    description:
      "Every change with actor and timestamp, and a revert when someone gets it wrong.",
    footer: "POST /api/admin/audit-logs/:id/revert",
  },
} as const satisfies Record<string, FeatureCellCopy>;

export const ASCII_STATEMENT = {
  eyebrow: "VISIBILITY",
  title: "Know where everything is. And what state it's in.",
  body: "Every asset has an owner, a location and a status, and every change to them is recorded. When a phone goes in for repair, you know who had it, where it went and when it comes back.",
  specs: [
    "locations · nested",
    "assignees · users or places",
    "history · per asset",
  ],
} as const;

export const TCO = {
  eyebrow: "UNDERSTAND",
  title: "See what your hardware really costs.",
  body: "Purchase price and maintenance per category on the TCO dashboard, and depreciation schedules as CSV or XLSX for finance.",
  footer: "GET /api/export?entity=depreciation",
} as const;

export const DEPLOY = {
  eyebrow: "DEPLOY",
  title: "Your server or ours.",
  selfHost: {
    title: "Self-host",
    body: "MIT-licensed. Run it on your own hardware with Docker and PostgreSQL.",
    command:
      "git clone https://github.com/LucaGerlich/asset-tracker && cd asset-tracker && docker compose --profile with-db up -d --build",
  },
  cloud: {
    title: "Cloud",
    body: "Hosted in the EU, with managed updates and backups. Start free, upgrade when you grow.",
  },
} as const;

export const FAQ_HEADING = {
  eyebrow: "FAQ",
  title: "Frequently asked questions",
} as const;

export const FINAL_CTA = {
  title: "Start tracking in minutes.",
  sub: "Free to start. No credit card required.",
} as const;
