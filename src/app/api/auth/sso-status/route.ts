import { NextResponse } from "next/server";
import { getSsoSettings } from "@/lib/sso";

/**
 * GET /api/auth/sso-status
 * Public endpoint returning SSO availability for the login page.
 * No auth required — the login page needs this before user is authenticated.
 */
export async function GET() {
  try {
    const settings = await getSsoSettings();

    return NextResponse.json({
      enabled: settings.enabled,
      provider: settings.provider,
      providerName: settings.providerName || (settings.provider === "saml" ? "SAML SSO" : "OpenID Connect"),
    });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}

export const dynamic = "force-dynamic";
