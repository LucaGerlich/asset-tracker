import { NextResponse } from "next/server";
import { validateSamlResponse } from "@/lib/sso";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { logger } from "@/lib/logger";
import { getBaseUrl } from "@/lib/url";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

/**
 * POST /api/auth/callback/saml
 * SAML Assertion Consumer Service (ACS) endpoint.
 * Receives SAML response from IdP, validates it, finds/creates user,
 * then redirects to login with a one-time token.
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const samlResponse = formData.get("SAMLResponse") as string;

    if (!samlResponse) {
      return NextResponse.redirect(
        new URL("/login?error=missing_saml_response", req.url),
      );
    }

    const profile = await validateSamlResponse({ SAMLResponse: samlResponse });

    if (!profile.email && !profile.username) {
      return NextResponse.redirect(
        new URL("/login?error=no_identity", req.url),
      );
    }

    // Find or create user
    let user = await prisma.user.findFirst({
      where: {
        OR: [
          ...(profile.email ? [{ email: profile.email }] : []),
          ...(profile.username ? [{ username: profile.username }] : []),
          { externalId: profile.nameID },
        ],
      },
    });

    if (!user) {
      // Auto-create SSO user
      const randomPassword = await bcrypt.hash(
        crypto.randomBytes(32).toString("hex"),
        10,
      );

      user = await prisma.user.create({
        data: {
          username: profile.username || profile.email || profile.nameID,
          email: profile.email || null,
          firstname: profile.firstName || "SSO",
          lastname: profile.lastName || "User",
          password: randomPassword,
          isadmin: false,
          canrequest: true,
          authProvider: "saml",
          externalId: profile.nameID,
          isActive: true,
          creation_date: new Date(),
        },
      });
    } else {
      // Update existing user with SSO info
      await prisma.user.update({
        where: { userid: user.userid },
        data: {
          authProvider: "saml",
          externalId: profile.nameID,
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
      details: { method: "saml", nameID: profile.nameID },
    });

    // Generate a one-time SSO token for seamless login
    const ssoToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 min

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

    // Redirect to login with SSO token
    return NextResponse.redirect(
      new URL(`/api/auth/sso-login?token=${ssoToken}`, getBaseUrl()),
    );
  } catch (error: any) {
    logger.error("SAML callback error", { error: error.message });
    return NextResponse.redirect(new URL("/login?error=saml_failed", req.url));
  }
}
