import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import { NextResponse } from "next/server";
import { generateCorrelationId } from "@/lib/logger";
import {
  checkRateLimit,
  createRateLimitHeaders,
  createRateLimitResponse,
  getClientIP,
  rateLimiters,
} from "@/lib/rate-limit";
import { isFeatureEnabled } from "@/lib/feature-flags";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Generate correlation ID for request tracing
  const correlationId = req.headers.get("x-correlation-id") || generateCorrelationId();
  
  // Public routes that don't require authentication
  const isPublicRoute = pathname === "/login";

  // Health check endpoints (always allow, no rate limiting)
  const isHealthRoute = pathname.startsWith("/api/health");

  // API routes (handle separately - will be protected at the API level)
  const isApiRoute = pathname.startsWith("/api");

  // Static files and Next.js internals (always allow)
  const isStaticFile = pathname.startsWith("/_next") ||
                      pathname.startsWith("/favicon") ||
                      pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/);

  if (isStaticFile) {
    return NextResponse.next();
  }

  // Allow health endpoints without authentication or rate limiting
  if (isHealthRoute) {
    const response = NextResponse.next();
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  // Apply rate limiting if enabled
  if (isFeatureEnabled("rateLimiting") && isApiRoute) {
    const clientIP = getClientIP(req);
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
    
    // Choose rate limiter based on endpoint and method
    let limiterConfig = rateLimiters.api;
    if (pathname === "/api/auth/callback/credentials") {
      limiterConfig = rateLimiters.login;
    } else if (isWriteOperation) {
      limiterConfig = rateLimiters.write;
    }
    
    const identifier = `${clientIP}:${pathname}`;
    const rateLimitResult = checkRateLimit(identifier, limiterConfig);
    
    if (!rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult, limiterConfig.message);
    }
    
    // Add rate limit headers to response for API routes
    const response = NextResponse.next();
    const rateLimitHeaders = createRateLimitHeaders(rateLimitResult);
    rateLimitHeaders.forEach((value, key) => {
      response.headers.set(key, value);
    });
    response.headers.set("x-correlation-id", correlationId);
    
    // If we got here with auth, continue to auth check
    if (isApiRoute && !isLoggedIn && !isPublicRoute) {
      // API routes handle their own auth, just return with headers
      return response;
    }
    
    return response;
  }

  // Redirect logged-in users away from login page
  if (isLoggedIn && isPublicRoute) {
    const response = NextResponse.redirect(new URL("/", req.url));
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  // Redirect non-logged-in users to login (except for API routes)
  if (!isLoggedIn && !isPublicRoute && !isApiRoute) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set("x-correlation-id", correlationId);
    return response;
  }

  const response = NextResponse.next();
  response.headers.set("x-correlation-id", correlationId);
  return response;
});

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
