import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import {
  WIDGET_DEFINITIONS,
  DEFAULT_WIDGETS,
} from "@/components/dashboard/WidgetRegistry";

// GET /api/dashboard/widgets — return user's widgets ordered by position
export async function GET() {
  try {
    const user = await requireApiAuth();

    const widgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });

    if (widgets.length === 0) {
      // Return default widgets with fake IDs when user has none saved
      const defaults = DEFAULT_WIDGETS.map((w, i) => ({
        id: `default-${i}`,
        userId: user.id,
        widgetType: w.widgetType,
        position: w.position,
        visible: true,
        config: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));
      return NextResponse.json(defaults);
    }

    return NextResponse.json(widgets);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET /api/dashboard/widgets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard widgets" },
      { status: 500 },
    );
  }
}

// PUT /api/dashboard/widgets — update widget order/visibility
export async function PUT(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const body = await req.json();
    const { widgets } = body as {
      widgets: Array<{ id: string; position: number; visible: boolean }>;
    };

    if (!Array.isArray(widgets)) {
      return NextResponse.json(
        { error: "Invalid body: widgets array required" },
        { status: 400 },
      );
    }

    // If widgets have default- IDs, we need to persist them first
    const hasDefaults = widgets.some((w) => w.id.startsWith("default-"));

    if (hasDefaults) {
      // Create real records for default widgets
      const defaultWidgetMap = new Map(
        DEFAULT_WIDGETS.map((dw, i) => [`default-${i}`, dw]),
      );

      const createPromises = widgets
        .filter((w) => w.id.startsWith("default-"))
        .map((w) => {
          const def = defaultWidgetMap.get(w.id);
          if (!def) return null;
          return prisma.dashboardWidget.create({
            data: {
              userId: user.id!,
              widgetType: def.widgetType,
              position: w.position,
              visible: w.visible,
            },
          });
        })
        .filter(Boolean);

      await Promise.all(createPromises);

      // Also update any real widgets
      const updatePromises = widgets
        .filter((w) => !w.id.startsWith("default-"))
        .map((w) =>
          prisma.dashboardWidget.update({
            where: { id: w.id },
            data: { position: w.position, visible: w.visible },
          }),
        );

      await Promise.all(updatePromises);
    } else {
      // Update existing widgets
      const updatePromises = widgets.map((w) =>
        prisma.dashboardWidget.update({
          where: { id: w.id },
          data: { position: w.position, visible: w.visible },
        }),
      );

      await Promise.all(updatePromises);
    }

    // Return the updated list
    const updated = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
      orderBy: { position: "asc" },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("PUT /api/dashboard/widgets error:", error);
    return NextResponse.json(
      { error: "Failed to update dashboard widgets" },
      { status: 500 },
    );
  }
}

// POST /api/dashboard/widgets — add a new widget
export async function POST(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const body = await req.json();
    const { widgetType } = body as { widgetType: string };

    if (!widgetType) {
      return NextResponse.json(
        { error: "widgetType is required" },
        { status: 400 },
      );
    }

    // Validate widgetType
    const validTypes = WIDGET_DEFINITIONS.map((w) => w.type);
    if (!validTypes.includes(widgetType)) {
      return NextResponse.json(
        {
          error: `Invalid widgetType. Must be one of: ${validTypes.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Ensure default widgets are persisted before adding a new one
    const existingWidgets = await prisma.dashboardWidget.findMany({
      where: { userId: user.id },
    });

    if (existingWidgets.length === 0) {
      // Persist default widgets first
      await Promise.all(
        DEFAULT_WIDGETS.map((dw) =>
          prisma.dashboardWidget.create({
            data: {
              userId: user.id!,
              widgetType: dw.widgetType,
              position: dw.position,
              visible: true,
            },
          }),
        ),
      );
    }

    // Find max position
    const maxPositionResult = await prisma.dashboardWidget.findFirst({
      where: { userId: user.id },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const newPosition = (maxPositionResult?.position ?? -1) + 1;

    const definition = WIDGET_DEFINITIONS.find((w) => w.type === widgetType);

    const widget = await prisma.dashboardWidget.create({
      data: {
        userId: user.id!,
        widgetType,
        position: newPosition,
        visible: true,
        config: definition?.defaultConfig
          ? JSON.parse(JSON.stringify(definition.defaultConfig))
          : undefined,
      },
    });

    return NextResponse.json(widget, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST /api/dashboard/widgets error:", error);
    return NextResponse.json(
      { error: "Failed to add dashboard widget" },
      { status: 500 },
    );
  }
}

// DELETE /api/dashboard/widgets?id=xxx — remove a widget
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireApiAuth();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Widget id is required" },
        { status: 400 },
      );
    }

    // If it's a default widget that hasn't been persisted, just return success
    if (id.startsWith("default-")) {
      return NextResponse.json({ success: true });
    }

    // Verify the widget belongs to the user
    const widget = await prisma.dashboardWidget.findFirst({
      where: { id, userId: user.id },
    });

    if (!widget) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    await prisma.dashboardWidget.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE /api/dashboard/widgets error:", error);
    return NextResponse.json(
      { error: "Failed to delete dashboard widget" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
