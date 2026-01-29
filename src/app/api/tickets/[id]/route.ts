import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireApiAuth, requireApiAdmin } from "@/lib/api-auth";

// PATCH /api/tickets/[id]
// Update ticket (status, priority, assignedTo)
// Only admins can update tickets
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
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
