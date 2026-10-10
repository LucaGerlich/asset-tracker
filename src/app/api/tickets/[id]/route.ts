import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  requireApiAdmin,
  requireNotDemoMode,
  requireSuperAdmin,
  requireWritableOrg,
} from "@/lib/api-auth";
import { apiErrorResponse } from "@/lib/errors";
import { createFreshdeskClient } from "@/lib/freshdesk";
import { logger } from "@/lib/logger";
import { decrypt } from "@/lib/encryption";
import { z } from "zod";
import {
  notifyTicketAssigned,
  notifyTicketStatusChanged,
} from "@/lib/notifications";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/tickets/[id]
 * Fetch a single ticket from Freshdesk. The Freshdesk account is one shared,
 * platform-level integration, so only super-admins may read through it.
 */
export async function GET(req: Request, { params }: RouteParams) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const ticketId = parseInt(id, 10);

    if (isNaN(ticketId)) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 });
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

    const client = createFreshdeskClient({
      domain: domainSetting.settingValue,
      apiKey: decrypt(apiKeySetting.settingValue),
    });

    const result = await client.getTicket(ticketId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Failed to fetch ticket" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ticket: result.data });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("GET /api/tickets/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to fetch ticket" },
      { status: 500 },
    );
  }
}

// PATCH /api/tickets/[id]
// Update a local ticket (status, priority, assignedTo)
// Only admins can update tickets
export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const demoBlock = requireNotDemoMode();
    if (demoBlock) return demoBlock;

    const user = await requireApiAdmin();
    await requireWritableOrg(user);
    const { id } = await params;
    const body = await req.json();

    const { status, priority, assignedTo } = body || {};

    // Fetch the existing ticket and verify it belongs to admin's org. A user
    // without an org owns no tickets: never widen the filter to every org.
    if (!user.organizationId) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }
    const existingTicket = await prisma.tickets.findFirst({
      where: {
        id,
        user_tickets_createdByTouser: { organizationId: user.organizationId },
      },
      select: { status: true, assignedTo: true, title: true },
    });

    if (!existingTicket) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    // The assignee is notified and shown the ticket: it must be a user of the
    // caller's org. `null` unassigns.
    if (assignedTo !== undefined && assignedTo !== null) {
      const assigneeId = z.string().uuid().safeParse(assignedTo);
      if (!assigneeId.success) {
        return NextResponse.json(
          { error: "assignedTo must be a user id or null" },
          { status: 400 },
        );
      }
      const assignee = await prisma.user.findFirst({
        where: {
          userid: assigneeId.data,
          organizationId: user.organizationId,
        },
        select: { userid: true },
      });
      if (!assignee) {
        return NextResponse.json(
          { error: "Assignee not found in your organization" },
          { status: 400 },
        );
      }
    }

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

    if (
      assignedTo &&
      assignedTo !== existingTicket.assignedTo &&
      ticket.assignee?.email
    ) {
      const assigneeName = `${ticket.assignee.firstname} ${ticket.assignee.lastname}`;
      notifyTicketAssigned(
        existingTicket.title,
        id,
        ticket.assignee.email,
        ticket.assignee.userid,
        assigneeName,
      ).catch((e) =>
        logger.error("Failed to send ticket assignment notification", {
          error: e,
        }),
      );
    }

    if (status && status !== existingTicket.status && ticket.creator?.email) {
      const creatorName = `${ticket.creator.firstname} ${ticket.creator.lastname}`;
      notifyTicketStatusChanged(
        existingTicket.title,
        id,
        ticket.creator.email,
        ticket.creator.userid,
        creatorName,
        existingTicket.status,
        status,
      ).catch((e) =>
        logger.error("Failed to send ticket status change notification", {
          error: e,
        }),
      );
    }

    return NextResponse.json(ticket, { status: 200 });
  } catch (error) {
    const denied = apiErrorResponse(error);
    if (denied) return denied;
    logger.error("PATCH /api/tickets/[id] error", { error });
    return NextResponse.json(
      { error: "Failed to update ticket" },
      { status: 500 },
    );
  }
}

export const dynamic = "force-dynamic";
