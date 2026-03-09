/**
 * BetterAuth server instance
 *
 * Central auth configuration replacing the old NextAuth setup.
 * Uses database-backed sessions with cookie caching.
 */

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import {
  genericOAuth,
  microsoftEntraId,
} from "better-auth/plugins/generic-oauth";
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
import {
  recordLoginAttempt,
  checkSuspiciousActivity,
  logSuspiciousActivity,
} from "@/lib/suspicious-activity";

/**
 * BetterAuth-specific Prisma client extension.
 *
 * BetterAuth's adapter factory has a bug: it overwrites the `id` field schema
 * in both transformInput and transformOutput, destroying any custom field name
 * mapping (e.g. `id: "userid"`). This extension works around the bug by
 * translating `id` ↔ `userid` at the Prisma query level for the user model.
 */
function translateIdToUserid(where: Record<string, unknown>) {
  if (!where || typeof where !== "object") return;
  if ("id" in where) {
    (where as Record<string, unknown>).userid = where.id;
    delete where.id;
  }
  for (const key of ["AND", "OR", "NOT"]) {
    const val = (where as Record<string, unknown>)[key];
    if (Array.isArray(val)) {
      val.forEach((clause: Record<string, unknown>) =>
        translateIdToUserid(clause),
      );
    } else if (val && typeof val === "object") {
      translateIdToUserid(val as Record<string, unknown>);
    }
  }
}

const authPrisma = (
  prisma as unknown as Record<string, unknown> & { $extends: Function }
).$extends({
  result: {
    user: {
      id: {
        needs: { userid: true },
        compute(user: { userid: string }) {
          return user.userid;
        },
      },
    },
  },
  query: {
    user: {
      $allOperations({
        args,
        query,
      }: {
        args: Record<string, unknown>;
        query: Function;
      }) {
        if (args.where)
          translateIdToUserid(args.where as Record<string, unknown>);
        if (args.data && typeof args.data === "object" && "id" in (args.data as Record<string, unknown>)) {
          const data = args.data as Record<string, unknown>;
          data.userid = data.id;
          delete data.id;
        }
        if (args.select && typeof args.select === "object" && "id" in (args.select as Record<string, unknown>)) {
          const select = args.select as Record<string, unknown>;
          select.userid = select.id;
          delete select.id;
        }
        return query(args);
      },
    },
  },
});

export const auth = betterAuth({
  appName: "AssetTracker",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXTAUTH_URL,
  basePath: "/api/auth",
  secret: process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET,

  database: prismaAdapter(authPrisma, { provider: "postgresql" }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    password: {
      async hash(password: string) {
        return bcrypt.hash(password, 12);
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
      id: "userid",
      name: "firstname", // BetterAuth expects 'name', map to firstname
      email: "email",
      emailVerified: "emailVerified",
      image: "image",
      createdAt: "creation_date",
      updatedAt: "updatedAt",
    },
    additionalFields: {
      username: {
        type: "string",
        required: false,
        input: true,
      },
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
    twoFactor({
      issuer: "AssetTracker",
    }),
    ...(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET
      ? [
          genericOAuth({
            config: [
              {
                ...microsoftEntraId({
                  clientId: process.env.MICROSOFT_CLIENT_ID,
                  clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
                  tenantId: process.env.MICROSOFT_TENANT_ID || "common",
                }),
                providerId: "microsoft",
              },
            ],
          }),
        ]
      : []),
    nextCookies(),
  ],

  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const body = ctx.body as
        | { email?: string; password?: string }
        | undefined;
      if (!body?.email) return;
      const rawIdentifier = body.email;

      // Cloudflare Turnstile verification (opt-in: only when secret key is configured)
      const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
      if (turnstileSecret) {
        const turnstileToken = ctx.headers?.get("x-turnstile-token") || "";
        if (!turnstileToken) {
          throw new Error("CAPTCHA verification required");
        }

        const ip =
          ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          ctx.headers?.get("x-real-ip") ||
          undefined;

        const verifyRes = await fetch(
          "https://challenges.cloudflare.com/turnstile/v0/siteverify",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              secret: turnstileSecret,
              response: turnstileToken,
              ...(ip && { remoteip: ip }),
            }),
          },
        );

        const verifyData = (await verifyRes.json()) as { success: boolean };
        if (!verifyData.success) {
          logger.securityEvent("Turnstile CAPTCHA verification failed", {
            identifier: rawIdentifier,
            ip: ip || "unknown",
          });
          throw new Error("CAPTCHA verification failed");
        }
      }

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

      // Look up user by email OR username
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ email: rawIdentifier }, { username: rawIdentifier }],
        },
        select: {
          userid: true,
          email: true,
          authProvider: true,
          username: true,
          isActive: true,
        },
      });

      // Use canonical email for lockout tracking (consistent key)
      const lockoutKey = user?.email ?? rawIdentifier;

      // Check account lockout
      const lockStatus = isAccountLocked(lockoutKey);
      if (lockStatus.locked) {
        logger.securityEvent("Login attempt on locked account", {
          identifier: lockoutKey,
        });
        throw new Error("Invalid credentials");
      }

      if (user && !user.isActive) {
        throw new Error("Invalid credentials");
      }

      // If user was found by username, rewrite email so BetterAuth can find them
      if (user?.email && user.email !== rawIdentifier) {
        body.email = user.email;
      }

      // Handle LDAP users — sync password to credential account
      if (user?.authProvider === "ldap" && body?.password) {
        const { authenticateUser: ldapAuth } = await import("@/lib/ldap");
        const ldapResult = await ldapAuth(
          user.username || rawIdentifier,
          body.password,
        );

        if (!ldapResult.success) {
          // Don't record here — after hook handles all failed attempt tracking
          throw new Error("Invalid credentials");
        }

        // LDAP auth succeeded — sync password hash so BetterAuth can verify
        const hashedPassword = await bcrypt.hash(body.password, 12);
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

      // Migrate local users from NextAuth: create credential account from user.password
      if (user && user.authProvider !== "ldap") {
        const fullUser = await prisma.user.findUnique({
          where: { userid: user.userid },
          select: { password: true },
        });

        if (fullUser?.password) {
          await prisma.accounts.upsert({
            where: {
              providerId_accountId: {
                providerId: "credential",
                accountId: user.userid,
              },
            },
            update: {},
            create: {
              userId: user.userid,
              providerId: "credential",
              accountId: user.userid,
              password: fullUser.password,
            },
          });
        }
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== "/sign-in/email") return;

      const body = ctx.body as { email?: string } | undefined;
      if (!body?.email) return;
      const identifier = body.email;

      // Check if login succeeded (session cookie was set)
      const setCookie = ctx.context.responseHeaders?.get("set-cookie");
      if (setCookie) {
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

          // --- Suspicious activity detection ---
          try {
            recordLoginAttempt(
              user.userid,
              ip || "unknown",
              userAgent || "unknown",
              true,
            );
            const suspiciousResult = checkSuspiciousActivity(
              user.userid,
              ip || "unknown",
              userAgent || "unknown",
            );
            logSuspiciousActivity(
              user.userid,
              ip || "unknown",
              userAgent || "unknown",
              suspiciousResult,
            );

            // Persist suspicious events to audit_logs
            if (suspiciousResult.suspicious) {
              await createAuditLog({
                userId: user.userid,
                action: AUDIT_ACTIONS.SECURITY_ALERT,
                entity: AUDIT_ENTITIES.USER,
                entityId: user.userid,
                details: {
                  type: "suspicious_login",
                  reasons: suspiciousResult.reasons,
                  ip: ip || "unknown",
                  userAgent: userAgent || "unknown",
                },
              });
            }
          } catch {
            // Non-critical — don't break login
          }
        }
      } else {
        // Login failed — single place for recording failed attempts
        recordFailedAttempt(identifier);

        // Record failed attempt for suspicious activity detection (IP-based)
        const failedIp =
          ctx.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          ctx.headers?.get("x-real-ip") ||
          "unknown";
        const failedUa = ctx.headers?.get("user-agent") || "unknown";
        recordLoginAttempt(null, failedIp, failedUa, false);
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
