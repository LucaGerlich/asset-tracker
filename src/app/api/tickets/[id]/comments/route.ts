import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAuth,
  requireNotDemoMode,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { notifyTicketComment } from "@/lib/notifications";

// POST /api/tickets/[id]/comments
// Add a comment to a ticket
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAuth();
    await requireWritableOrg(user);
    const { id } = await params;
    const body = await req.json();

    const { comment } = body || {};

    if (!comment) {
      return NextResponse.json(
        { error: "comment is required" },
        { status: 400 },
      );
    }

    // Verify user has access to this ticket
    const ticket = await prisma.tickets.findUnique({
      where: { id },
      include: {
        user_tickets_createdByTouser: {
          select: {
            userid: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });

    if (!ticket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // Users can only comment on their own tickets or if they're admin
    if (!user.isAdmin && ticket.createdBy !== user.id) {
      return NextResponse.json(
        { error: "Forbidden: You can only comment on your own tickets" },
        { status: 403 },
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

    // Fire-and-forget: notify ticket creator about the new comment (skip self-notifications)
    const creator = ticket.user_tickets_createdByTouser;
    if (creator?.email && creator.userid !== user.id) {
      const commenterName = ticketComment.user
        ? `${ticketComment.user.firstname} ${ticketComment.user.lastname}`
        : "Someone";
      const creatorName = `${creator.firstname} ${creator.lastname}`;
      notifyTicketComment(
        ticket.title,
        id,
        creator.email,
        creator.userid,
        creatorName,
        commenterName,
        comment,
      ).catch((e) =>
        logger.error("Failed to send ticket comment notification", {
          error: e,
        }),
      );
    }

    return NextResponse.json(ticketComment, { status: 201 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("POST /api/tickets/[id]/comments error", { error });
    return NextResponse.json(
      { error: "Failed to add comment" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
