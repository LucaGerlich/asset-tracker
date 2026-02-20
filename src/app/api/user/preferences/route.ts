import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth } from "@/lib/api-auth";
import prisma from "@/lib/prisma";

const DEFAULTS = {
  theme: "system",
  locale: "en",
  timezone: "UTC",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,234.56",
  pageSize: 20,
  onboardingCompleted: false,
  dashboardLayout: null,
  helpDismissed: null,
};

export async function GET() {
  try {
    const user = await requireApiAuth();

    const preferences = await prisma.user_preferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      return NextResponse.json(DEFAULTS);
    }

    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireApiAuth();

    const body = await request.json();
    const {
      theme,
      locale,
      timezone,
      currency,
      dateFormat,
      numberFormat,
      pageSize,
      onboardingCompleted,
      dashboardLayout,
      helpDismissed,
    } = body;

    const values: Record<string, unknown> = {};
    if (theme !== undefined) values.theme = theme;
    if (locale !== undefined) values.locale = locale;
    if (timezone !== undefined) values.timezone = timezone;
    if (currency !== undefined) values.currency = currency;
    if (dateFormat !== undefined) values.dateFormat = dateFormat;
    if (numberFormat !== undefined) values.numberFormat = numberFormat;
    if (pageSize !== undefined) values.pageSize = pageSize;
    if (onboardingCompleted !== undefined)
      values.onboardingCompleted = onboardingCompleted;
    if (dashboardLayout !== undefined) values.dashboardLayout = dashboardLayout;
    if (helpDismissed !== undefined) values.helpDismissed = helpDismissed;

    const preferences = await prisma.user_preferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        ...values,
        updatedAt: new Date(),
      },
      update: {
        ...values,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
