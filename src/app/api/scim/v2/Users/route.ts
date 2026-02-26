import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  authenticateScim,
  scimHeaders,
  scimError,
  userToScim,
  scimListResponse,
} from "@/lib/scim";
import { logger } from "@/lib/logger";
import { createAuditLog, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit-log";

const USER_SELECT = {
  userid: true,
  username: true,
  firstname: true,
  lastname: true,
  email: true,
  isActive: true,
  externalId: true,
  creation_date: true,
  change_date: true,
} as const;

/**
 * GET /api/scim/v2/Users
 * List users (SCIM 2.0 RFC 7644 Section 3.4.2)
 * Supports: filter, startIndex, count
 */
export async function GET(req: Request) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const url = new URL(req.url);
    const startIndex = Math.max(1, parseInt(url.searchParams.get("startIndex") || "1", 10));
    const count = Math.min(100, Math.max(1, parseInt(url.searchParams.get("count") || "100", 10)));
    const filter = url.searchParams.get("filter");
    const baseUrl = `${url.protocol}//${url.host}`;

    // Basic SCIM filter support: userName eq "value"
    let where: any = {};
    if (filter) {
      const match = filter.match(/userName\s+eq\s+"([^"]+)"/i);
      if (match) {
        where.username = match[1];
      }
      const emailMatch = filter.match(/emails\.value\s+eq\s+"([^"]+)"/i);
      if (emailMatch) {
        where.email = emailMatch[1];
      }
      const extMatch = filter.match(/externalId\s+eq\s+"([^"]+)"/i);
      if (extMatch) {
        where.externalId = extMatch[1];
      }
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: USER_SELECT,
        skip: startIndex - 1,
        take: count,
        orderBy: { creation_date: "asc" },
      }),
      prisma.user.count({ where }),
    ]);

    const resources = users.map((u) => userToScim(u, baseUrl));

    return NextResponse.json(
      scimListResponse(resources, total, startIndex),
      { headers: scimHeaders() },
    );
  } catch (error) {
    logger.error("SCIM GET /Users error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

/**
 * POST /api/scim/v2/Users
 * Create user (SCIM 2.0 RFC 7644 Section 3.3)
 */
export async function POST(req: Request) {
  const authErr = await authenticateScim(req);
  if (authErr) return authErr;

  try {
    const body = await req.json();
    const url = new URL(req.url);
    const baseUrl = `${url.protocol}//${url.host}`;

    const userName = body.userName;
    const givenName = body.name?.givenName || "SCIM";
    const familyName = body.name?.familyName || "User";
    const email = body.emails?.[0]?.value || null;
    const externalId = body.externalId || null;
    const active = body.active !== false;

    if (!userName) {
      return NextResponse.json(
        scimError("userName is required", 400),
        { status: 400, headers: scimHeaders() },
      );
    }

    // Check for existing user
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: userName },
          ...(email ? [{ email }] : []),
          ...(externalId ? [{ externalId }] : []),
        ],
      },
    });

    if (existing) {
      return NextResponse.json(
        scimError("User already exists", 409),
        { status: 409, headers: scimHeaders() },
      );
    }

    // Create user with random password (SCIM users auth via IdP)
    const randomPassword = await bcrypt.hash(
      crypto.randomBytes(32).toString("hex"),
      10,
    );

    const user = await prisma.user.create({
      data: {
        username: userName,
        email,
        firstname: givenName,
        lastname: familyName,
        password: randomPassword,
        isadmin: false,
        canrequest: true,
        authProvider: "scim",
        externalId,
        isActive: active,
        scimProviderId: externalId,
        scimLastSync: new Date(),
        creation_date: new Date(),
      },
      select: USER_SELECT,
    });

    await createAuditLog({
      userId: user.userid,
      action: AUDIT_ACTIONS.CREATE,
      entity: AUDIT_ENTITIES.USER,
      entityId: user.userid,
      details: { method: "scim", userName },
    });

    return NextResponse.json(
      userToScim(user, baseUrl),
      { status: 201, headers: scimHeaders() },
    );
  } catch (error) {
    logger.error("SCIM POST /Users error", { error });
    return NextResponse.json(
      scimError("Internal server error", 500),
      { status: 500, headers: scimHeaders() },
    );
  }
}

export const dynamic = "force-dynamic";
