// Host-based split between the marketing site (NEXT_PUBLIC_MARKETING_URL)
// and the app (BETTER_AUTH_URL). Disabled unless both are set.

export interface SplitOrigins {
  marketing: URL;
  app: URL;
}

export type HostKind = "marketing" | "app" | "other";

// Plain record so callers/tests can pass partial envs (Next's ProcessEnv
// augmentation makes NODE_ENV mandatory).
export type EnvRecord = Readonly<Record<string, string | undefined>>;

export type HostRoute =
  { kind: "pass" } | { kind: "redirect"; url: string; status: 308 };

export const MARKETING_PATHS: ReadonlySet<string> = new Set([
  "/",
  "/pricing",
  "/terms",
  "/privacy",
  "/opengraph-image",
  "/sitemap.xml",
  "/robots.txt",
]);

// Marketing pages that live only on the marketing host.
const MARKETING_ONLY_PATHS: ReadonlySet<string> = new Set([
  "/pricing",
  "/terms",
  "/privacy",
  "/sitemap.xml",
]);

const STATIC_FILE = /\.(png|jpg|jpeg|gif|svg|ico|webp)$/;

function alwaysPasses(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/__nextjs") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname.startsWith("/api/health") ||
    pathname === "/monitoring" ||
    pathname.startsWith("/monitoring/") ||
    STATIC_FILE.test(pathname)
  );
}

export function getSplitOrigins(
  env: EnvRecord = process.env,
): SplitOrigins | null {
  const marketing = env.NEXT_PUBLIC_MARKETING_URL;
  const app = env.BETTER_AUTH_URL;
  if (!marketing || !app) return null;
  return { marketing: new URL(marketing), app: new URL(app) };
}

export function getHostKind(
  host: string | null,
  origins: SplitOrigins,
): HostKind {
  const h = (host ?? "").toLowerCase();
  if (h === origins.marketing.host) return "marketing";
  if (h === origins.app.host) return "app";
  return "other";
}

// String concatenation (not new URL(path, base)) so a path like "//evil.com"
// stays a path on the configured origin instead of becoming a new authority.
function redirectTo(origin: URL, pathname: string, search: string): HostRoute {
  return {
    kind: "redirect",
    url: `${origin.origin}${pathname}${search}`,
    status: 308,
  };
}

export function resolveHostRoute(input: {
  host: string | null;
  pathname: string;
  search: string;
  origins: SplitOrigins | null;
}): HostRoute {
  const { host, pathname, search, origins } = input;
  if (!origins || alwaysPasses(pathname)) return { kind: "pass" };

  const kind = getHostKind(host, origins);
  if (kind === "marketing" && !MARKETING_PATHS.has(pathname)) {
    return redirectTo(origins.app, pathname, search);
  }
  if (kind === "app" && MARKETING_ONLY_PATHS.has(pathname)) {
    return redirectTo(origins.marketing, pathname, search);
  }
  return { kind: "pass" };
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

// Fails fast on a split that would silently misroute (spec §2).
export function validateSplitConfig(
  env: EnvRecord = process.env,
): string | null {
  const marketingRaw = env.NEXT_PUBLIC_MARKETING_URL;
  if (!marketingRaw) return null;
  if (!env.BETTER_AUTH_URL) {
    return "NEXT_PUBLIC_MARKETING_URL is set but BETTER_AUTH_URL (the app origin) is not";
  }
  const marketing = parseUrl(marketingRaw);
  const app = parseUrl(env.BETTER_AUTH_URL);
  if (!marketing || !app) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must each be a valid URL";
  }
  if (marketing.origin === app.origin) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must differ (marketing vs app host)";
  }
  if (
    env.NODE_ENV === "production" &&
    (marketing.protocol !== "https:" || app.protocol !== "https:")
  ) {
    return "NEXT_PUBLIC_MARKETING_URL and BETTER_AUTH_URL must use https in production";
  }
  return null;
}
