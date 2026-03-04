import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";
import { authConfig } from "./auth.config";
import { logger } from "@/lib/logger";
import {
  isAccountLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  formatLockoutMessage,
} from "@/lib/account-lockout";
import { createSessionRecord } from "@/lib/session-tracking";
import { checkRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";
import crypto from "crypto";

// Login schema validation
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1),
});

// MFA login schema (second step — username + mfaToken + mfaChallenge, no password)
const mfaLoginSchema = z.object({
  username: z.string().min(3).max(50),
  mfaToken: z.string().min(1),
  isBackupCode: z.string().optional(),
  mfaChallenge: z.string().optional(),
});

// MFA challenge token helpers — binds step 2 to a successful step 1
const MFA_CHALLENGE_TTL = 5 * 60 * 1000; // 5 minutes

function createMfaChallenge(userId: string): string {
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "fallback";
  const expires = Date.now() + MFA_CHALLENGE_TTL;
  const payload = `${userId}:${expires}`;
  const hmac = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}:${hmac}`;
}

function verifyMfaChallenge(
  challenge: string | undefined,
  userId: string,
): boolean {
  if (!challenge) return false;
  const secret =
    process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "fallback";
  const parts = challenge.split(":");
  if (parts.length !== 3) return false;
  const [challengeUserId, expiresStr, providedHmac] = parts;
  if (challengeUserId !== userId) return false;
  const expires = parseInt(expiresStr, 10);
  if (Date.now() > expires) return false;
  const expectedHmac = crypto
    .createHmac("sha256", secret)
    .update(`${challengeUserId}:${expiresStr}`)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(providedHmac),
    Buffer.from(expectedHmac),
  );
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user }) {
      // Add user info to JWT token on initial login
      if (user) {
        token.id = user.id;
        token.username = (user as Record<string, unknown>).username as
          | string
          | undefined;
        token.isAdmin = (user as Record<string, unknown>).isAdmin as
          | boolean
          | undefined;
        token.canRequest = (user as Record<string, unknown>).canRequest as
          | boolean
          | undefined;
        token.firstname = (user as Record<string, unknown>).firstname as
          | string
          | undefined;
        token.lastname = (user as Record<string, unknown>).lastname as
          | string
          | undefined;
        token.organizationId = (user as Record<string, unknown>)
          .organizationId as string | undefined;
        token.departmentId = (user as Record<string, unknown>).departmentId as
          | string
          | undefined;
        token.mfaPending = (user as Record<string, unknown>).mfaPending as
          | boolean
          | undefined;
        token.mfaChallenge = (user as Record<string, unknown>).mfaChallenge as
          | string
          | undefined;
        token.sessionVersion = Date.now();
      }

      // Re-validate user exists every hour
      if (
        token.id &&
        token.sessionVersion &&
        typeof token.sessionVersion === "number"
      ) {
        const hourAgo = Date.now() - 60 * 60 * 1000;
        if (token.sessionVersion < hourAgo) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { userid: token.id as string },
              select: { userid: true, isadmin: true, isActive: true },
            });
            if (!dbUser || dbUser.isActive === false) {
              // User deleted or deactivated — invalidate session
              return null as unknown as typeof token;
            }
            // Refresh admin status from DB to catch privilege changes
            token.isAdmin = dbUser.isadmin;
            token.sessionVersion = Date.now();
          } catch {
            // DB error — don't invalidate, just skip revalidation
          }
        }
      }

      return token;
    },
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        mfaToken: { label: "MFA Token", type: "text" },
        isBackupCode: { label: "Is Backup Code", type: "text" },
        mfaChallenge: { label: "MFA Challenge", type: "text" },
      },
      async authorize(credentials) {
        try {
          // Rate limit login attempts by IP
          const headersList = await headers();
          const loginIp =
            headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            headersList.get("x-real-ip") ||
            "127.0.0.1";
          const loginRl = checkRateLimit(`login:${loginIp}`, {
            maxRequests: 10,
            windowMs: 15 * 60 * 1000, // 10 attempts per 15 min
          });
          if (!loginRl.success) {
            throw new Error("Too many login attempts. Please try again later.");
          }

          const rawMfaToken = credentials?.mfaToken as string | undefined;

          // ---- MFA VERIFICATION PATH ----
          // If mfaToken is provided, this is the second step of login
          if (rawMfaToken && rawMfaToken.length > 0) {
            const { username, mfaToken, isBackupCode, mfaChallenge } =
              mfaLoginSchema.parse(credentials);

            const user = await prisma.user.findUnique({
              where: { username },
              select: {
                userid: true,
                username: true,
                email: true,
                firstname: true,
                lastname: true,
                isadmin: true,
                canrequest: true,
                organizationId: true,
                departmentId: true,
                mfaEnabled: true,
                mfaSecret: true,
                mfaBackupCodes: true,
              },
            });

            if (!user || !user.mfaEnabled || !user.mfaSecret) {
              logger.warn(
                "MFA verification failed - invalid user or MFA not enabled",
                { username },
              );
              return null;
            }

            // Verify the MFA challenge token from step 1 (binds step 2 to step 1)
            if (!verifyMfaChallenge(mfaChallenge, user.userid)) {
              logger.warn(
                "MFA verification failed - invalid or expired challenge token",
                { username },
              );
              return null;
            }

            let isValid = false;
            const useBackupCode = isBackupCode === "true";

            if (useBackupCode) {
              const result = verifyBackupCode(user.mfaBackupCodes, mfaToken);
              isValid = result.valid;

              if (isValid) {
                // Remove used backup code
                await prisma.user.update({
                  where: { userid: user.userid },
                  data: { mfaBackupCodes: result.remainingCodes },
                });
              }
            } else {
              isValid = verifyMfaToken(user.mfaSecret, mfaToken);
            }

            if (!isValid) {
              logger.warn("MFA verification failed - invalid token", {
                username,
              });
              await createAuditLog({
                userId: user.userid,
                action: AUDIT_ACTIONS.LOGIN_FAILED,
                entity: AUDIT_ENTITIES.USER,
                entityId: user.userid,
                details: {
                  username,
                  reason: useBackupCode
                    ? "Invalid MFA backup code"
                    : "Invalid MFA token",
                },
              });
              return null;
            }

            // MFA verified successfully — complete login
            recordSuccessfulLogin(username);

            await createAuditLog({
              userId: user.userid,
              action: AUDIT_ACTIONS.LOGIN,
              entity: AUDIT_ENTITIES.USER,
              entityId: user.userid,
              details: {
                username,
                mfaMethod: useBackupCode ? "backup_code" : "totp",
              },
            });

            logger.info("MFA login successful", {
              username,
              userId: user.userid,
            });

            // Create session record
            try {
              const headersList = await headers();
              const ipAddress =
                headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
                headersList.get("x-real-ip") ||
                null;
              const userAgent = headersList.get("user-agent") || null;
              await createSessionRecord(user.userid, ipAddress, userAgent);
            } catch (sessionError) {
              logger.error("Failed to create session record", { sessionError });
            }

            // Return user WITHOUT mfaPending (MFA has been verified)
            return {
              id: user.userid,
              name: `${user.firstname} ${user.lastname}`,
              email: user.email,
              username: user.username,
              isAdmin: user.isadmin,
              canRequest: user.canrequest,
              firstname: user.firstname,
              lastname: user.lastname,
              organizationId: user.organizationId || undefined,
              departmentId: user.departmentId || undefined,
              mfaPending: false,
            };
          }

          // ---- NORMAL PASSWORD LOGIN PATH ----
          const { username, password } = loginSchema.parse(credentials);

          // Check if account is locked
          const lockStatus = isAccountLocked(username);
          if (lockStatus.locked) {
            logger.securityEvent("Login attempt on locked account", {
              username,
              remainingMs: lockStatus.remainingMs,
            });
            await createAuditLog({
              userId: null,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: null,
              details: {
                username,
                reason: "Account locked",
                unlockTime: lockStatus.unlockTime?.toISOString(),
              },
            });
            return null;
          }

          // Find user in database
          const user = await prisma.user.findUnique({
            where: { username },
            select: {
              userid: true,
              username: true,
              email: true,
              firstname: true,
              lastname: true,
              isadmin: true,
              canrequest: true,
              password: true,
              organizationId: true,
              departmentId: true,
              mfaEnabled: true,
              authProvider: true,
              isActive: true,
            },
          });

          if (!user) {
            logger.warn("Login failed - user not found", { username });
            recordFailedAttempt(username);
            await createAuditLog({
              userId: null,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: null,
              details: { username, reason: "User not found" },
            });
            return null;
          }

          // Check if user account is active
          if (user.isActive === false) {
            logger.warn("Login failed - account deactivated", { username });
            await createAuditLog({
              userId: user.userid,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: user.userid,
              details: { username, reason: "Account deactivated" },
            });
            return null;
          }

          // ---- LDAP AUTHENTICATION PATH ----
          // If user's authProvider is "ldap", authenticate via LDAP bind
          if (user.authProvider === "ldap") {
            const { authenticateUser: ldapAuth } = await import("@/lib/ldap");
            const ldapResult = await ldapAuth(username, password);

            if (!ldapResult.success) {
              logger.warn("Login failed - LDAP bind failed", { username });
              const lockoutResult = recordFailedAttempt(username);
              await createAuditLog({
                userId: user.userid,
                action: AUDIT_ACTIONS.LOGIN_FAILED,
                entity: AUDIT_ENTITIES.USER,
                entityId: user.userid,
                details: {
                  username,
                  reason: "LDAP authentication failed",
                  attemptsRemaining: lockoutResult.attemptsRemaining,
                },
              });
              return null;
            }

            // LDAP auth succeeded — skip password check, proceed to MFA / return
            recordSuccessfulLogin(username);

            await createAuditLog({
              userId: user.userid,
              action: AUDIT_ACTIONS.LOGIN,
              entity: AUDIT_ENTITIES.USER,
              entityId: user.userid,
              details: { username, method: "ldap" },
            });

            logger.info("LDAP login successful", {
              username,
              userId: user.userid,
            });

            if (user.mfaEnabled) {
              return {
                id: user.userid,
                name: `${user.firstname} ${user.lastname}`,
                email: user.email,
                username: user.username,
                isAdmin: user.isadmin,
                canRequest: user.canrequest,
                firstname: user.firstname,
                lastname: user.lastname,
                organizationId: user.organizationId || undefined,
                departmentId: user.departmentId || undefined,
                mfaPending: true,
                mfaChallenge: createMfaChallenge(user.userid),
              };
            }

            try {
              const headersList = await headers();
              const ipAddress =
                headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
                headersList.get("x-real-ip") ||
                null;
              const userAgent = headersList.get("user-agent") || null;
              await createSessionRecord(user.userid, ipAddress, userAgent);
            } catch (sessionError) {
              logger.error("Failed to create session record", { sessionError });
            }

            return {
              id: user.userid,
              name: `${user.firstname} ${user.lastname}`,
              email: user.email,
              username: user.username,
              isAdmin: user.isadmin,
              canRequest: user.canrequest,
              firstname: user.firstname,
              lastname: user.lastname,
              organizationId: user.organizationId || undefined,
              departmentId: user.departmentId || undefined,
              mfaPending: false,
            };
          }

          // ---- LOCAL PASSWORD VERIFICATION ----
          // Verify password
          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            logger.warn("Login failed - invalid password", { username });
            const lockoutResult = recordFailedAttempt(username);
            await createAuditLog({
              userId: user.userid,
              action: AUDIT_ACTIONS.LOGIN_FAILED,
              entity: AUDIT_ENTITIES.USER,
              entityId: user.userid,
              details: {
                username,
                reason: "Invalid password",
                attemptsRemaining: lockoutResult.attemptsRemaining,
                locked: lockoutResult.locked,
              },
            });
            return null;
          }

          // If MFA is enabled, return user with mfaPending flag + challenge token
          // The user will need to complete MFA verification before getting full access
          if (user.mfaEnabled) {
            logger.info("Login requires MFA verification", {
              username,
              userId: user.userid,
            });

            return {
              id: user.userid,
              name: `${user.firstname} ${user.lastname}`,
              email: user.email,
              username: user.username,
              isAdmin: user.isadmin,
              canRequest: user.canrequest,
              firstname: user.firstname,
              lastname: user.lastname,
              organizationId: user.organizationId || undefined,
              departmentId: user.departmentId || undefined,
              mfaPending: true,
              mfaChallenge: createMfaChallenge(user.userid),
            };
          }

          // No MFA — complete login normally
          recordSuccessfulLogin(username);

          await createAuditLog({
            userId: user.userid,
            action: AUDIT_ACTIONS.LOGIN,
            entity: AUDIT_ENTITIES.USER,
            entityId: user.userid,
            details: { username },
          });

          logger.info("Login successful", { username, userId: user.userid });

          // Create session record for concurrent session tracking
          try {
            const headersList = await headers();
            const ipAddress =
              headersList.get("x-forwarded-for")?.split(",")[0].trim() ||
              headersList.get("x-real-ip") ||
              null;
            const userAgent = headersList.get("user-agent") || null;
            await createSessionRecord(user.userid, ipAddress, userAgent);
          } catch (sessionError) {
            logger.error("Failed to create session record", { sessionError });
          }

          // Return user object (password excluded)
          return {
            id: user.userid,
            name: `${user.firstname} ${user.lastname}`,
            email: user.email,
            username: user.username,
            isAdmin: user.isadmin,
            canRequest: user.canrequest,
            firstname: user.firstname,
            lastname: user.lastname,
            organizationId: user.organizationId || undefined,
            departmentId: user.departmentId || undefined,
            mfaPending: false,
          };
        } catch (error) {
          logger.error("Authorization error", { error });
          return null;
        }
      },
    }),
  ],
});

// Export lockout utilities for use in login form
export { isAccountLocked, formatLockoutMessage };
