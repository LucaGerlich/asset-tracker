import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireNotDemoMode } from "@/lib/api-auth";
import { createFreshdeskClient, SUPPORTED_TICKET_TYPES } from "@/lib/freshdesk";
import { decrypt } from "@/lib/encryption";
import { getOrganizationContext } from "@/lib/organization-context";
import {
  parsePaginationParams,
  buildPrismaArgs,
  buildPaginatedResponse,
} from "@/lib/pagination";
import { logger } from "@/lib/logger";

const TICKET_SORT_FIELDS = [
  "title",
  "status",
  "priority",
  "createdAt",
  "updatedAt",
];

// Supports two sources:
// - Default (local): Returns tickets from the local database based on user role
// - Freshdesk (?source=freshdesk): Returns tickets from Freshdesk API
export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get("source");

  if (source === "freshdesk") {
    return getFreshdeskTickets(req, url);
  }

  return getLocalTickets(url);
}

async function getLocalTickets(url: URL) {
  try {
    const user = await requireApiAuth();
    const searchParams = url.searchParams;

    // Scope tickets to user's organization (through creator's org)
    const orgContext = await getOrganizationContext();
    const orgId = orgContext?.organization?.id;
    const where: Record<string, unknown> = user.isAdmin
      ? orgId
        ? { user_tickets_createdByTouser: { organizationId: orgId } }
        : {}
      : { createdBy: user.id };

    const include = {
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
          createdAt: "asc" as const,
        },
      },
    };

    // If no `page` param, return all results for backward compatibility
    if (!searchParams.has("page")) {
      const rawTickets = await prisma.tickets.findMany({
        where,
        include,
        orderBy: { createdAt: "desc" },
      });

      const tickets = rawTickets.map((ticket) => ({
        ...ticket,
        creator: ticket.user_tickets_createdByTouser,
        assignee: ticket.user_tickets_assignedToTouser,
        comments: ticket.ticket_comments,
      }));

      return NextResponse.json(tickets, { status: 200 });
    }

    // Paginated path
    const params = parsePaginationParams(searchParams);
    const prismaArgs = buildPrismaArgs(params, TICKET_SORT_FIELDS);

    // Search filter
    if (params.search) {
      where.OR = [
        { title: { contains: params.search, mode: "insensitive" } },
        { description: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [rawTickets, total] = await Promise.all([
      prisma.tickets.findMany({ where, include, ...prismaArgs }),
      prisma.tickets.count({ where }),
    ]);

    // Map Prisma relation names to expected interface names
    const tickets = rawTickets.map((ticket) => ({
      ...ticket,
      creator: ticket.user_tickets_createdByTouser,
      assignee: ticket.user_tickets_assignedToTouser,
      comments: ticket.ticket_comments,
    }));

    return NextResponse.json(buildPaginatedResponse(tickets, total, params), {
      status: 200,
    });
  } catch (error) {
    logger.error("GET /api/tickets error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}

// Fetch tickets from Freshdesk API (admin-only)
async function getFreshdeskTickets(req: Request, url: URL) {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user?.isadmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [domainSetting, apiKeySetting] = await Promise.all([
      prisma.system_settings.findUnique({
        where: { settingKey: "freshdesk_domain" },
      }),
      prisma.system_settings.findUnique({
        where: { settingKey: "freshdesk_api_key" },
      }),
    ]);

    if (!domainSetting?.settingValue || !apiKeySetting?.settingValue) {
      return NextResponse.json(
        {
          error:
            "Freshdesk is not configured. Please configure it in Admin Settings.",
        },
        { status: 400 },
      );
    }

    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const typeFilter = url.searchParams.get("type");

    // Decrypt the API key (may be encrypted at rest)
    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: decrypt(apiKeySetting.settingValue),
    });

    // Determine which types to filter
    const types = typeFilter ? [typeFilter] : [...SUPPORTED_TICKET_TYPES];

    const result = await client.getTicketsByTypes(types, page);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch tickets" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      tickets: result.data || [],
      page,
      types: SUPPORTED_TICKET_TYPES,
    });
  } catch (error) {
    logger.error("GET /api/tickets (freshdesk) error", { error });
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 },
    );
  }
}

// POST /api/tickets
// Create a new ticket (any authenticated user can create)
export async function POST(req: Request) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    const body = await req.json();

    const { title, description, priority } = body || {};

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
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
    logger.error("POST /api/tickets error", { error });
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to create ticket" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
