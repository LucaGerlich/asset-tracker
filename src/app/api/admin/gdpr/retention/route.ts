import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getGDPRSettings, saveGDPRSettings } from "@/lib/gdpr-settings";

/**
 * GET /api/admin/gdpr/retention
 * Returns current GDPR retention settings (or defaults if none exist).
 */
export async function GET() {
  try {
    await requireApiAdmin();
    const settings = getGDPRSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error("GET /api/admin/gdpr/retention error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to get retention settings" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/gdpr/retention
 * Updates GDPR retention settings.
 */
export async function PUT(req: Request) {
  try {
    await requireApiAdmin();
    const body = await req.json();

    const { auditLogRetentionDays, deletedUserRetentionDays, exportRetentionDays } = body;

    // Validate input
    if (
      typeof auditLogRetentionDays !== "number" ||
      typeof deletedUserRetentionDays !== "number" ||
      typeof exportRetentionDays !== "number"
    ) {
      return NextResponse.json(
        { error: "All retention values must be numbers" },
        { status: 400 }
      );
    }

    if (
      auditLogRetentionDays < 1 ||
      deletedUserRetentionDays < 1 ||
      exportRetentionDays < 1
    ) {
      return NextResponse.json(
        { error: "Retention values must be at least 1 day" },
        { status: 400 }
      );
    }

    const updated = saveGDPRSettings({
      auditLogRetentionDays,
      deletedUserRetentionDays,
      exportRetentionDays,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/admin/gdpr/retention error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message.includes("Forbidden")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Failed to update retention settings" },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
