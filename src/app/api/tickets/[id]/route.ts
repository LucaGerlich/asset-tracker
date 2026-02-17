import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/api-auth";
import { createFreshdeskClient } from "@/lib/freshdesk";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tickets/[id]
 * Fetch a single ticket from Freshdesk
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json(
        { error: "Invalid ticket ID" },
        { status: 400 }
      );
    }

    // Get Freshdesk configuration from database
    const [domainSetting, apiKeySetting] = await Promise.all([
      prisma.systemSettings.findUnique({
        where: { settingKey: "freshdesk_domain" },
      }),
      prisma.systemSettings.findUnique({
        where: { settingKey: "freshdesk_api_key" },
      }),
    ]);

    if (!domainSetting?.settingValue || !apiKeySetting?.settingValue) {
      return NextResponse.json(
        { error: "Freshdesk is not configured. Please configure it in Admin Settings." },
        { status: 400 }
      );
    }

    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: apiKeySetting.settingValue,
    });

    const result = await client.getTicket(ticketId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch ticket" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ticket: result.data });
  } catch (error) {
    console.error("GET /api/tickets/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 }
    );
  }
}

// PATCH /api/tickets/[id]
// Update a local ticket (status, priority, assignedTo)
// Only admins can update tickets
export async function PATCH(
  req: Request,
  { params }: RouteParams
) {
  try {
    const user = await requireApiAdmin();
    const { id } = await params;
    const body = await req.json();

    const { status, priority, assignedTo } = body || {};

    const updateData: any = {
      updatedAt: new Date(),
    };

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assignedTo !== undefined) updateData.assignedTo = assignedTo;

    const rawTicket = await prisma.tickets.update({
      where: { id },
      data: updateData,
      include: {
        user_tickets_createdByTouser: {
          select: {
            userid: true,
            username: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        user_tickets_assignedToTouser: {
          select: {
            userid: true,
            username: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });

    // Map Prisma relation names to expected interface names
    const ticket = {
      ...rawTicket,
      creator: rawTicket.user_tickets_createdByTouser,
      assignee: rawTicket.user_tickets_assignedToTouser,
      comments: [],
    };

    return NextResponse.json(ticket, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/tickets/[id] error:", error);
    if (error instanceof Error) {
      if (error.message === "Unauthorized") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.includes("Forbidden")) {
        return NextResponse.json({ error: "Forbidden: Admin access required" }, { status: 403 });
      }
    }
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
