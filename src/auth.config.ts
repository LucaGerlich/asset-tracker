import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import type { NextURL } from "next/dist/server/web/next-url";

// Extended User type with custom fields
interface ExtendedUser extends User {
  username?: string;
  isAdmin?: boolean;
  canRequest?: boolean;
  firstname?: string;
  lastname?: string;
  organizationId?: string;
  departmentId?: string;
  mfaPending?: boolean;
}

// Extended JWT type with custom fields
interface ExtendedJWT extends JWT {
  id?: string;
  username?: string;
  isAdmin?: boolean;
  canRequest?: boolean;
  firstname?: string;
  lastname?: string;
  organizationId?: string;
  departmentId?: string;
  permissions?: string[];
  mfaPending?: boolean;
}

// Extended Session type with custom fields
interface ExtendedSession extends Session {
  user: {
    id?: string;
    username?: string;
    isAdmin?: boolean;
    canRequest?: boolean;
    firstname?: string;
    lastname?: string;
    organizationId?: string;
    departmentId?: string;
    permissions?: string[];
    mfaPending?: boolean;
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
}

// Edge-compatible auth config (no database, no bcrypt)
// This file can be imported in middleware which runs on Edge runtime
export const authConfig: NextAuthConfig = {
  providers: [],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }: { auth: Session | null; request: { nextUrl: NextURL } }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = nextUrl;

      // Public routes accessible without authentication
      const publicRoutes = [
        "/login",
        "/register",
        "/forgot-password",
        "/reset-password",
        "/pricing",
        "/terms",
        "/privacy",
        "/offline",
      ];
      const isPublicRoute =
        pathname === "/" ||
        publicRoutes.some((r) => pathname === r || pathname.startsWith(r + "/"));
      const isApiRoute = pathname.startsWith("/api/");
      const isMfaVerifyRoute = pathname === "/mfa-verify";
      const isAuthApiRoute = pathname.startsWith("/api/auth");

      // Check if user has MFA pending
      const extSession = auth as ExtendedSession | null;
      const mfaPending = extSession?.user?.mfaPending === true;

      // Allow public routes and all API routes (API routes handle their own auth)
      if (isPublicRoute || isApiRoute) {
        return true;
      }

      if (!isLoggedIn) {
        return false;
      }

      // If MFA is pending, only allow MFA verify page and auth API routes
      if (mfaPending) {
        if (isMfaVerifyRoute || isAuthApiRoute) {
          return true;
        }
        return Response.redirect(new URL("/mfa-verify", nextUrl));
      }

      // If MFA is not pending but user is on MFA verify page, redirect to dashboard
      if (isMfaVerifyRoute && !mfaPending) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return isLoggedIn;
    },
    async jwt({ token, user }: { token: ExtendedJWT; user?: ExtendedUser }) {
      // Add user info to JWT token
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.isAdmin = user.isAdmin;
        token.canRequest = user.canRequest;
        token.firstname = user.firstname;
        token.lastname = user.lastname;
        token.organizationId = user.organizationId;
        token.departmentId = user.departmentId;
        token.mfaPending = user.mfaPending;
      }
      return token;
    },
    async session({ session, token }: { session: ExtendedSession; token: ExtendedJWT }) {
      // Add user info to session
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.isAdmin = token.isAdmin;
        session.user.canRequest = token.canRequest;
        session.user.firstname = token.firstname;
        session.user.lastname = token.lastname;
        session.user.organizationId = token.organizationId;
        session.user.departmentId = token.departmentId;
        session.user.permissions = token.permissions;
        session.user.mfaPending = token.mfaPending;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
};
