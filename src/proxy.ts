import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { generateCorrelationId } from "@/lib/logger";
import {
  checkRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIP,
  rateLimiters,
} from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";

function buildCspHeader(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' 'unsafe-eval'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://*.sentry.io https://*.stripe.com https://*.basemaps.cartocdn.com https://*.cartocdn.com https://nominatim.openstreetmap.org https://analytics.711x.de https://challenges.cloudflare.com${process.env.NODE_ENV !== "production" ? " https://127.0.0.1:41951" : ""}`,
    "worker-src 'self' blob:",
    "frame-src 'self' https://*.stripe.com https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const session = getSessionCookie(req);
  const isLoggedIn = !!session;

  // Generate correlation ID for request tracing
  const correlationId =
    req.headers.get("x-correlation-id") || generateCorrelationId();

  // Generate per-request CSP nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const cspHeader = buildCspHeader(nonce);

  // Stamp security headers (CSP + nonce + correlation ID) on every response.
  // Accepts both NextResponse and plain Response (e.g. from createRateLimitResponse).
  function withHeaders<T extends Response>(response: T): T {
    response.headers.set("Content-Security-Policy", cspHeader);
    response.headers.set("x-nonce", nonce);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  // For NextResponse.next(), also pass the nonce as a request header so
  // the app (layout.tsx) can read it via headers().get("x-nonce")
  function nextWithNonce(): NextResponse {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    return withHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
    );
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/",
    "/login",
    "/register",
    "/setup",
    "/forgot-password",
    "/reset-password",
    "/pricing",
    "/terms",
    "/privacy",
    "/offline",
    "/invite",
    "/suspended",
  ];
  const isPublicRoute = publicRoutes.some(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );

  // Health check endpoints (always allow, no rate limiting)
  const isHealthRoute = pathname.startsWith("/api/health");

  // API routes (handle separately - will be protected at the API level)
  const isApiRoute = pathname.startsWith("/api");

  // Static files and Next.js internals (always allow)
  const isStaticFile =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icons/") ||
    pathname === "/sw.js" ||
    pathname === "/manifest.json" ||
    pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/);

  if (isStaticFile) {
    return NextResponse.next();
  }

  // Allow health endpoints without authentication or rate limiting
  if (isHealthRoute) {
    return nextWithNonce();
  }

  // Apply rate limiting if enabled
  if (isFeatureEnabled("rateLimiting") && isApiRoute) {
    const clientIP = getClientIP(req);
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(
      req.method,
    );

    // Choose rate limiter based on endpoint and method
    let limiterConfig = rateLimiters.api;
    if (pathname.startsWith("/api/auth/sign-in")) {
      limiterConfig = rateLimiters.login;
    } else if (isWriteOperation) {
      limiterConfig = rateLimiters.write;
    }

    const identifier = `${clientIP}:${pathname}`;
    const rateLimitResult = await checkRateLimit(identifier, limiterConfig);

    if (!rateLimitResult.success) {
      return withHeaders(
        createRateLimitResponse(rateLimitResult, limiterConfig.message),
      );
    }

    // Add rate limit headers to response for API routes
    const response = nextWithNonce();
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    rateLimitHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });

    return response;
  }

  // Redirect logged-in users away from login page
  if (isLoggedIn && pathname === "/login") {
    return withHeaders(NextResponse.redirect(new URL("/dashboard", req.url)));
  }

  // Redirect non-logged-in users to login (except for API routes)
  if (!isLoggedIn && !isPublicRoute && !isApiRoute) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return withHeaders(NextResponse.redirect(loginUrl));
  }

  return nextWithNonce();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - images and other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
