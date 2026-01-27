import { auth } from "./auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isLoggedIn = !!req.auth;

  // Public routes that don't require authentication
  const isPublicRoute = pathname === "/login";

  // API routes (handle separately - will be protected at the API level)
  const isApiRoute = pathname.startsWith("/api");

  // Static files and Next.js internals (always allow)
  const isStaticFile = pathname.startsWith("/_next") || 
                      pathname.startsWith("/favicon") ||
                      pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/);

  if (isStaticFile) {
    return NextResponse.next();
  }

  // Redirect logged-in users away from login page
  if (isLoggedIn && isPublicRoute) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Redirect non-logged-in users to login (except for API routes)
  if (!isLoggedIn && !isPublicRoute && !isApiRoute) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
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
