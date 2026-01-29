import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth } from "@/lib/api-auth";

// POST /api/tickets/[id]/comments
// Add a comment to a ticket
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireApiAuth();
    const { id } = await params;
    const body = await req.json();

    const { comment } = body || {};

    if (!comment) {
      return NextResponse.json(
        { error: "comment is required" },
        { status: 400 }
      );
    }

    // Verify user has access to this ticket
    const ticket = await prisma.tickets.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json(
        { error: "Ticket not found" },
        { status: 404 }
      );
    }

    // Users can only comment on their own tickets or if they're admin
    if (!user.isAdmin && ticket.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only comment on your own tickets" },
        { status: 403 }
      );
    }

    const ticketComment = await prisma.ticket_comments.create({
      data: {
        ticketId: id,
        userId: user.id!,
        comment,
      },
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
    });

    return NextResponse.json(ticketComment, { status: 201 });
  } catch (error) {
    console.error("POST /api/tickets/[id]/comments error:", error);
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";
