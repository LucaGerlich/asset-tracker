import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

// GET /api/tickets
// Returns tickets based on user role:
// - Admins: all tickets
// - Regular users: only their own tickets
export async function GET(req: Request) {
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
