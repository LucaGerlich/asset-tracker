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
      const isPublicRoute = nextUrl.pathname === "/login";

      if (isPublicRoute) {
        return true;
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
