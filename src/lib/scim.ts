/**
 * SCIM 2.0 (RFC 7644) utilities
 *
 * Provides bearer token authentication and user schema mapping
 * between SCIM User resources and our Prisma user model.
 */

import prisma from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import crypto from "crypto";

// ---------------------------------------------------------------------------
// SCIM Bearer Token Auth
// ---------------------------------------------------------------------------

/**
 * Validate SCIM bearer token from Authorization header.
 * The token is stored encrypted in system_settings as "scim.bearerToken".
 */
export async function authenticateScim(
  req: Request,
): Promise<NextResponse | null> {
  const authHeader = req.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json(scimError("Unauthorized", 401), {
      status: 401,
      headers: scimHeaders(),
    });
  }

  const token = authHeader.slice(7);

  const tokenRow = await prisma.system_settings.findUnique({
    where: { settingKey: "scim.bearerToken" },
  });

  if (!tokenRow || !tokenRow.settingValue) {
    return NextResponse.json(scimError("SCIM is not configured", 403), {
      status: 403,
      headers: scimHeaders(),
    });
  }

  const storedToken = tokenRow.isEncrypted
    ? decrypt(tokenRow.settingValue)
    : tokenRow.settingValue;

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

  return null; // Auth passed
}

// ---------------------------------------------------------------------------
// SCIM Response Helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// User <-> SCIM Resource Mapping
// ---------------------------------------------------------------------------

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
