import { NextResponse } from "next/server";
import { isValidCronAuth } from "@/lib/cron-auth";
import {
  getIntuneSettings,
  syncIntuneDevices,
} from "@/lib/integrations/intune";
import { logger } from "@/lib/logger";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isValidCronAuth(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await getIntuneSettings();
    if (!settings.enabled || !settings.autoSync) {
      return NextResponse.json(
        { success: true, skipped: true, reason: "Intune sync not enabled" },
        { status: 200 },
      );
    }

    // Sync for all organizations (cron context has no org scope)
    const result = await syncIntuneDevices(null, "cron");

    return NextResponse.json({ success: true, ...result }, { status: 200 });
  } catch (error) {
    logger.error("Cron intune-sync error", { error });
    return NextResponse.json(
      { error: "Failed to sync Intune devices" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
