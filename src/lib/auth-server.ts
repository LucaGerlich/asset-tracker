/**
 * BetterAuth server instance
 *
 * Central auth configuration replacing the old NextAuth setup.
 * Uses database-backed sessions with cookie caching.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { username } from "better-auth/plugins/username";
import { nextCookies } from "better-auth/next-js";
import { createAuthMiddleware } from "@better-auth/core/api";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logger } from "@/lib/logger";
import {
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
} from "@/lib/account-lockout";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { checkRateLimit } from "@/lib/rate-limit";
import { parseDeviceName, parseBrowser } from "@/lib/session-tracking";

export const auth = betterAuth({
  appName: "AssetTracker",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,

  database: prismaAdapter(prisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    password: {
      async hash(password: string) {
        return bcrypt.hash(password, 10);
      },
      async verify({ hash, password }: { hash: string; password: string }) {
        return bcrypt.compare(password, hash);
      },
    },
    autoSignIn: true,
  },

  user: {
    modelName: "user",
    fields: {
      name: "firstname", // BetterAuth expects 'name', map to firstname
      email: "email",
      emailVerified: "emailVerified",
      image: "image",
      createdAt: "creation_date",
      updatedAt: "updatedAt",
    },
    additionalFields: {
      lastname: {
        type: "string",
        required: true,
        input: true,
      },
      isadmin: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      canrequest: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      organizationId: {
        type: "string",
        required: false,
        input: true,
      },
      departmentId: {
        type: "string",
        required: false,
      },
      authProvider: {
        type: "string",
        required: false,
        defaultValue: "local",
      },
      isActive: {
        type: "boolean",
        required: false,
        defaultValue: true,
      },
      mfaEnabled: {
        type: "boolean",
        required: false,
        defaultValue: false,
      },
      password: {
        type: "string",
        required: false,
      },
    },
  },

  account: {
    modelName: "accounts",
    fields: {
      userId: "userId",
      accountId: "accountId",
      providerId: "providerId",
      accessToken: "accessToken",
      refreshToken: "refreshToken",
      accessTokenExpiresAt: "accessTokenExpiresAt",
      refreshTokenExpiresAt: "refreshTokenExpiresAt",
      scope: "scope",
      idToken: "idToken",
      password: "password",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
  },

  session: {
    modelName: "sessions",
    fields: {
      token: "token",
      userId: "userId",
      expiresAt: "expiresAt",
      ipAddress: "ipAddress",
      userAgent: "userAgent",
      createdAt: "createdAt",
      updatedAt: "updatedAt",
    },
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60,
    },
  },

  plugins: [
    username(),
    twoFactor({
      issuer: "AssetTracker",
    }),
    nextCookies(),
  ],

  advanced: {
    database: {
      generateId: false, // Let PostgreSQL generate UUIDs
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" && ctx.path !== "/sign-in/username") return;

      const body = ctx.body as
        | { email?: string; username?: string; password?: string }
        | undefined;
      const identifier = body?.email || body?.username;
      if (!identifier) return;

      // Rate limit by IP
      const ip =
        ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        ctx.headers?.get("x-real-ip") ||
        "127.0.0.1";
      const rl = checkRateLimit(`login:${ip}`, {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
      });
      if (!rl.success) {
        throw new Error("Too many login attempts. Please try again later.");
      }

      // Check account lockout
      const lockStatus = isAccountLocked(identifier);
      if (lockStatus.locked) {
        logger.securityEvent("Login attempt on locked account", {
          identifier,
        });
        throw new Error("Account is temporarily locked.");
      }

      // Look up user by email OR username
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: identifier }, { username: identifier }],
        },
        select: {
          userid: true,
          email: true,
          authProvider: true,
          username: true,
          isActive: true,
        },
      });

      if (user && !user.isActive) {
        throw new Error("Account has been deactivated.");
      }

      // Handle LDAP users — sync password to credential account
      if (user?.authProvider === "ldap" && body?.password) {
        const { authenticateUser: ldapAuth } = await import("@/lib/ldap");
        const ldapResult = await ldapAuth(
          user.username || identifier,
          body.password,
        );

        if (!ldapResult.success) {
          recordFailedAttempt(identifier);
          throw new Error("Invalid credentials");
        }

        // LDAP auth succeeded — sync password hash so BetterAuth can verify
        const hashedPassword = await bcrypt.hash(body.password, 10);
        await prisma.accounts.upsert({
          where: {
            providerId_accountId: {
              providerId: "credential",
              accountId: user.userid,
            },
          },
          update: { password: hashedPassword },
          create: {
            userId: user.userid,
            providerId: "credential",
            accountId: user.userid,
            password: hashedPassword,
          },
        });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email" && ctx.path !== "/sign-in/username") return;

      const body = ctx.body as { email?: string; username?: string } | undefined;
      const identifier = body?.email || body?.username;
      if (!identifier) return;

      // Check if login succeeded (session cookie was set)
      const setCookie = ctx.context.responseHeaders?.get("set-cookie");
      if (setCookie) {
        // Login succeeded
        recordSuccessfulLogin(identifier);

        const user = await prisma.user.findFirst({
          where: {
            OR: [{ email: identifier }, { username: identifier }],
          },
          select: { userid: true, username: true },
        });

        if (user) {
          await createAuditLog({
            userId: user.userid,
            action: AUDIT_ACTIONS.LOGIN,
            entity: AUDIT_ENTITIES.USER,
            entityId: user.userid,
            details: {
              username: user.username,
              method: "credentials",
            },
          });

          // Enrich the most recent session with device info
          const ip =
            ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            ctx.headers?.get("x-real-ip") ||
            null;
          const userAgent = ctx.headers?.get("user-agent") || null;
          const deviceName = `${parseDeviceName(userAgent)} - ${parseBrowser(userAgent)}`;

          try {
            const latestSession = await prisma.sessions.findFirst({
              where: { userId: user.userid },
              orderBy: { createdAt: "desc" },
            });
            if (latestSession) {
              await prisma.sessions.update({
                where: { id: latestSession.id },
                data: {
                  deviceName,
                  lastActive: new Date(),
                  isCurrent: true,
                },
              });
            }
          } catch {
            // Non-critical — don't break login
          }
        }
      } else {
        // Login failed
        recordFailedAttempt(identifier);
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
