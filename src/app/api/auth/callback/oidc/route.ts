import { NextResponse } from "next/server";
import { exchangeOidcCode } from "@/lib/sso";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

/**
 * GET /api/auth/callback/oidc
 * OIDC callback endpoint. Receives authorization code from IdP,
 * exchanges for tokens, finds/creates user, then redirects to login.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    const state = url.searchParams.get("state");

    if (error) {
      return NextResponse.redirect(new URL(`/login?error=${error}`, req.url));
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/login?error=missing_code", req.url),
      );
    }

    // Verify OIDC state parameter to prevent CSRF
    const cookieHeader = req.headers.get("cookie") ?? "";
    const cookieState = cookieHeader
      .split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith("oidc_state="))
      ?.slice("oidc_state=".length);

    if (!state || !cookieState || state !== cookieState) {
      logger.warn("OIDC state mismatch", {
        hasState: !!state,
        hasCookie: !!cookieState,
      });
      return NextResponse.redirect(
        new URL("/login?error=invalid_state", req.url),
      );
    }

    const profile = await exchangeOidcCode(code);

    if (!profile.email && !profile.username) {
      return NextResponse.redirect(
        new URL("/login?error=no_identity", req.url),
      );
    }

    // Find or create user. Only match on externalId (our own SSO-linked
    // identifier) or on email when the IdP cryptographically confirmed it
    // (profile.emailVerified, derived from a signature-verified ID token).
    // Matching on a bare/unverified email or on username would let an
    // attacker who controls those claims at the IdP take over an existing
    // local account.
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { externalId: profile.sub },
          ...(profile.emailVerified && profile.email
            ? [{ email: profile.email }]
            : []),
        ],
      },
    });

    if (!user) {
      const randomPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10,
      );

      if (profile.email && !profile.emailVerified) {
        logger.warn(
          "OIDC profile email is not verified by the IdP; creating user without email",
          { sub: profile.sub },
        );
      }

      user = await prisma.user.create({
        data: {
          username: profile.username || profile.email || profile.sub,
          email: profile.emailVerified ? profile.email || null : null,
          firstname: profile.firstName || "SSO",
          lastname: profile.lastName || "User",
          password: randomPassword,
          isadmin: false,
          canrequest: true,
          authProvider: "oidc",
          externalId: profile.sub,
          isActive: true,
          creation_date: new Date(),
        },
      });
    } else {
      await prisma.user.update({
        where: { userid: user.userid },
        data: {
          authProvider: "oidc",
          externalId: profile.sub,
          firstname: profile.firstName || user.firstname,
          lastname: profile.lastName || user.lastname,
          lastSyncedAt: new Date(),
          change_date: new Date(),
        },
      });
    }

    await createAuditLog({
      userId: user.userid,
      action: AUDIT_ACTIONS.LOGIN,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.userid,
      details: { method: "oidc", sub: profile.sub },
    });

    // Generate one-time SSO login token
    const ssoToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await prisma.system_settings.upsert({
      where: { settingKey: `sso.token.${ssoToken}` },
      update: {
        settingValue: JSON.stringify({
          userId: user.userid,
          expiresAt: expiresAt.toISOString(),
        }),
        updatedAt: new Date(),
      },
      create: {
        settingKey: `sso.token.${ssoToken}`,
        settingValue: JSON.stringify({
          userId: user.userid,
          expiresAt: expiresAt.toISOString(),
        }),
        settingType: "json",
        category: "sso",
        updatedAt: new Date(),
      },
    });

    const redirectResponse = NextResponse.redirect(
      new URL(`/api/auth/sso-login?token=${ssoToken}`, getBaseUrl()),
    );
    // Clear the state cookie after successful verification
    redirectResponse.cookies.delete("oidc_state");
    return redirectResponse;
  } catch (error: any) {
    logger.error("OIDC callback error", { error: error.message });
    return NextResponse.redirect(new URL("/login?error=oidc_failed", req.url));
  }
}
