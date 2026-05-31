/**
 * SCIM 2.0 (RFC 7644) utilities
 *
 * Provides bearer token authentication and user schema mapping
 * between SCIM User resources and our Prisma user model.
 */

import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";
import crypto from "crypto";

export interface ScimAuthResult {
  organizationId: string;
}

/**
 * Validate SCIM bearer token from Authorization header.
 * Tokens are stored per-org in the scim_tokens table.
 * Returns the matched organization ID on success, or a NextResponse error.
 */
export async function authenticateScim(
  req: Request,
): Promise<NextResponse | ScimAuthResult> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(scimError("Unauthorized", 401), {
      status: 401,
      headers: scimHeaders(),
    });
  }

  const token = authHeader.slice(7);

  // Look up all SCIM tokens and compare with timing-safe equality
  const scimTokens = await prisma.scimToken.findMany({
    select: { token: true, organizationId: true },
  });

  if (scimTokens.length === 0) {
    // Fall back to legacy global token in system_settings
    const legacyRow = await prisma.system_settings.findUnique({
      where: { settingKey: "scim.bearerToken" },
    });

    if (!legacyRow?.settingValue) {
      return NextResponse.json(scimError("SCIM is not configured", 403), {
        status: 403,
        headers: scimHeaders(),
      });
    }

    const storedToken = legacyRow.isEncrypted
      ? decrypt(legacyRow.settingValue)
      : legacyRow.settingValue;

    const tokenBuf = Buffer.from(token);
    const storedBuf = Buffer.from(storedToken);
    if (
      tokenBuf.length !== storedBuf.length ||
      !crypto.timingSafeEqual(tokenBuf, storedBuf)
    ) {
      return NextResponse.json(scimError("Invalid bearer token", 401), {
        status: 401,
        headers: scimHeaders(),
      });
    }

    // Legacy token — find the first org as fallback
    const firstOrg = await prisma.organization.findFirst({
      select: { id: true },
    });
    if (!firstOrg) {
      return NextResponse.json(scimError("No organization found", 500), {
        status: 500,
        headers: scimHeaders(),
      });
    }
    return { organizationId: firstOrg.id };
  }

  const tokenBuf = Buffer.from(token);
  for (const record of scimTokens) {
    const storedToken = record.token;
    const storedBuf = Buffer.from(storedToken);
    if (
      tokenBuf.length === storedBuf.length &&
      crypto.timingSafeEqual(tokenBuf, storedBuf)
    ) {
      return { organizationId: record.organizationId };
    }
  }

  return NextResponse.json(scimError("Invalid bearer token", 401), {
    status: 401,
    headers: scimHeaders(),
  });
}

export function scimHeaders(): Record<string, string> {
  return { "Content-Type": "application/scim+json" };
}

export function scimError(
  detail: string,
  status: number,
): Record<string, unknown> {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail,
    status,
  };
}

export interface ScimUser {
  schemas: string[];
  id: string;
  externalId?: string;
  userName: string;
  name: {
    givenName: string;
    familyName: string;
  };
  emails: Array<{ value: string; primary: boolean; type: string }>;
  active: boolean;
  meta: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export function userToScim(
  user: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
    isActive: boolean;
    externalId: string | null;
    creation_date: Date;
    change_date: Date | null;
  },
  baseUrl: string,
): ScimUser {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: user.userid,
    externalId: user.externalId || undefined,
    userName: user.username || user.email || user.userid,
    name: {
      givenName: user.firstname,
      familyName: user.lastname,
    },
    emails: user.email
      ? [{ value: user.email, primary: true, type: "work" }]
      : [],
    active: user.isActive,
    meta: {
      resourceType: "User",
      created: user.creation_date.toISOString(),
      lastModified: (user.change_date || user.creation_date).toISOString(),
      location: `${baseUrl}/api/scim/v2/Users/${user.userid}`,
    },
  };
}

export function scimListResponse(
  resources: ScimUser[],
  totalResults: number,
  startIndex: number,
): Record<string, unknown> {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults,
    itemsPerPage: resources.length,
    startIndex,
    Resources: resources,
  };
}
