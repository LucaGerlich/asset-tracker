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
import { headers } from "next/headers";
import { verifyMfaToken, verifyBackupCode } from "@/lib/mfa";

// Login schema validation
const loginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(1),
});

// MFA login schema (second step — username + mfaToken, no password)
const mfaLoginSchema = z.object({
  username: z.string().min(3).max(50),
  mfaToken: z.string().min(1),
  isBackupCode: z.string().optional(),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        mfaToken: { label: "MFA Token", type: "text" },
        isBackupCode: { label: "Is Backup Code", type: "text" },
      },
      async authorize(credentials) {
        try {
          const rawMfaToken = credentials?.mfaToken as string | undefined;

          // ---- MFA VERIFICATION PATH ----
          // If mfaToken is provided, this is the second step of login
          if (rawMfaToken && rawMfaToken.length > 0) {
            const { username, mfaToken, isBackupCode } = mfaLoginSchema.parse(credentials);

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
              logger.warn("MFA verification failed - invalid user or MFA not enabled", { username });
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
              logger.warn("MFA verification failed - invalid token", { username });
              await createAuditLog({
                userId: user.userid,
                action: AUDIT_ACTIONS.LOGIN_FAILED,
                entity: AUDIT_ENTITIES.USER,
                entityId: user.userid,
                details: {
                  username,
                  reason: useBackupCode ? "Invalid MFA backup code" : "Invalid MFA token",
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

            logger.info("MFA login successful", { username, userId: user.userid });

            // Create session record
            try {
              const headersList = await headers();
              const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0].trim()
                || headersList.get("x-real-ip")
                || null;
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

          // If MFA is enabled, return user with mfaPending flag
          // The user will need to complete MFA verification before getting full access
          if (user.mfaEnabled) {
            logger.info("Login requires MFA verification", { username, userId: user.userid });

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
            const ipAddress = headersList.get("x-forwarded-for")?.split(",")[0].trim()
              || headersList.get("x-real-ip")
              || null;
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
