import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isSelfHosted } from "@/lib/deployment-mode";
import { resolveOrgStatus } from "@/lib/org-suspension";

const LOCKED_REDIRECT_PATH = "/suspended";

/** Path prefixes (matched per segment) that are never gated on the org lock. */
const UNGATED_PREFIXES = [
  "/api",
  "/_next",
  "/monitoring",
  LOCKED_REDIRECT_PATH,
  "/icons",
];

const STATIC_FILE = /\.(png|jpe?g|gif|svg|ico|webp)$/i;
const STATIC_PATHS = new Set(["/sw.js", "/manifest.json"]);

function hasPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * True only for app page requests. APIs enforce the lock in their own guards;
 * public pages, the Sentry tunnel, static assets and /suspended itself must
 * stay reachable for a locked org.
 */
export function shouldCheckOrgLock(
  pathname: string,
  isPublicRoute: boolean,
): boolean {
  if (isPublicRoute) return false;
  if (STATIC_PATHS.has(pathname) || STATIC_FILE.test(pathname)) return false;
  return !UNGATED_PREFIXES.some((prefix) => hasPrefix(pathname, prefix));
}

/**
 * Resolve the redirect target for a signed-in user whose organization is
 * locked out, or null when the request may continue.
 *
 * Uses the session cookie cache plus one user/org lookup. Any failure fails
 * open (and is logged): this only steers page navigation, while the API guards
 * keep blocking locked orgs.
 */
export async function getLockedRedirect(req: NextRequest): Promise<URL | null> {
  if (isSelfHosted()) return null;

  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id;
    if (!userId) return null;

    const user = await prisma.user.findUnique({
      where: { userid: userId },
      select: {
        organization: { select: { isActive: true, suspendedAt: true } },
      },
    });

    if (resolveOrgStatus(user?.organization ?? null) !== "locked_out") {
      return null;
    }
    return new URL(LOCKED_REDIRECT_PATH, req.url);
  } catch (error) {
    logger.error("Org lock check failed; allowing request", { error });
    return null;
  }
}
