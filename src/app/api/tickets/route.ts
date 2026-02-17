import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";
import { createFreshdeskClient, SUPPORTED_TICKET_TYPES } from "@/lib/freshdesk";

// GET /api/tickets
// Supports two sources:
// - Default (local): Returns tickets from the local database based on user role
// - Freshdesk (?source=freshdesk): Returns tickets from Freshdesk API
export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source");

  if (source === "freshdesk") {
    return getFreshdeskTickets(req, url);
  }

  return getLocalTickets();
}

// Fetch tickets from the local Prisma database
async function getLocalTickets() {
  try {
    const user = await requireApiAuth();

    // Admins see all tickets, users see only their own
    const rawTickets = await prisma.tickets.findMany({
      where: user.isAdmin ? {} : { createdBy: user.id },
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
        ticket_comments: {
          include: {
            user: {
              select: {
                userid: true,
                username: true,
                firstname: true,
                lastname: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Map Prisma relation names to expected interface names
    const tickets = rawTickets.map((ticket) => ({
      ...ticket,
      creator: ticket.user_tickets_createdByTouser,
      assignee: ticket.user_tickets_assignedToTouser,
      comments: ticket.ticket_comments,
    }));

    return NextResponse.json(tickets, { status: 200 });
  } catch (error) {
    console.error("GET /api/tickets error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to fetch tickets" }, { status: 500 });
  }
}

// Fetch tickets from Freshdesk API
async function getFreshdeskTickets(req: Request, url: URL) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Parse query params
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const typeFilter = url.searchParams.get("type");

    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: apiKeySetting.settingValue,
    });

    // Determine which types to filter
    const types = typeFilter
      ? [typeFilter]
      : [...SUPPORTED_TICKET_TYPES];

    const result = await client.getTicketsByTypes(types, page);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch tickets" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      tickets: result.data || [],
      page,
      types: SUPPORTED_TICKET_TYPES,
    });
  } catch (error) {
    console.error("GET /api/tickets (freshdesk) error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

// POST /api/tickets
// Create a new ticket (any authenticated user can create)
export async function POST(req: Request) {
  try {
    const user = await requireApiAuth();
    const body = await req.json();

    const { title, description, priority } = body || {};

    if (!title) {
      return NextResponse.json(
        { error: "title is required" },
        { status: 400 }
      );
    }

    const rawTicket = await prisma.tickets.create({
      data: {
        title,
        description: description || null,
        priority: priority || "medium",
        user_tickets_createdByTouser: {
          connect: { userid: user.id! },
        },
        status: "new",
        updatedAt: new Date(),
      },
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
      },
    });

    // Map Prisma relation names to expected interface names
    const ticket = {
      ...rawTicket,
      creator: rawTicket.user_tickets_createdByTouser,
      assignee: null,
      comments: [],
    };

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
