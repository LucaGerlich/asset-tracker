import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireSuperAdmin,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";

const S = process.env.DB_SCHEMA || "assettool";
const RL_TABLE = `"${S}"."rate_limits"`;

export const dynamic = "force-dynamic";

// The rate_limits table is platform-wide: it holds the counters of every
// tenant. Reading or resetting it is a super-admin operation, not an org-admin
// one.
export async function GET() {
  try {
    await requireSuperAdmin();

    const rows = await prisma.$queryRawUnsafe<
      Array<{ key: string; count: number; reset_at: Date }>
    >(
      `SELECT "key", "count", "reset_at" FROM ${RL_TABLE} ORDER BY "count" DESC LIMIT 200`,
    );

    const entries = rows.map((r) => ({
      key: r.key,
      count: r.count,
      resetAt:
        r.reset_at instanceof Date
          ? r.reset_at.toISOString()
          : String(r.reset_at),
      isExpired: new Date(r.reset_at) < new Date(),
    }));

    return NextResponse.json({
      entries,
      total: entries.length,
      activeCount: entries.filter((e) => !e.isExpired).length,
    });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/admin/rate-limits error", { error });
    return NextResponse.json(
      { error: "Failed to fetch rate limits" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;
    const user = await requireSuperAdmin();
    await requireWritableOrg(user);

    const { key } = await req.json();
    if (!key) {
      return NextResponse.json({ error: "key required" }, { status: 400 });
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM ${RL_TABLE} WHERE "key" = $1`,
      key,
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("DELETE /api/admin/rate-limits error", { error });
    return NextResponse.json(
      { error: "Failed to reset rate limit" },
      { status: 500 },
    );
  }
}
