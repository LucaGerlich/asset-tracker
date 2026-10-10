import prisma from "@/lib/prisma";

/**
 * Tickets raised by users of one organization (scoped through the creator,
 * like /api/tickets). A viewer without an organization sees none: no query
 * runs, so the filter can never be dropped and widen to every tenant.
 */
export async function getTickets(organizationId: string | null) {
  if (!organizationId) return [];

  const rawTickets = await prisma.tickets.findMany({
    where: { user_tickets_createdByTouser: { organizationId } },
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
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  // Map Prisma relation names to expected interface names
  return rawTickets.map((ticket) => ({
    ...ticket,
    creator: ticket.user_tickets_createdByTouser,
    assignee: ticket.user_tickets_assignedToTouser,
    comments: ticket.ticket_comments,
  }));
}

/** Admins of one organization, for the assignee picker. */
export async function getAdminUsers(organizationId: string | null) {
  if (!organizationId) return [];

  return await prisma.user.findMany({
    where: {
      isadmin: true,
      organizationId,
    },
    select: {
      userid: true,
      username: true,
      firstname: true,
      lastname: true,
    },
    orderBy: {
      firstname: "asc",
    },
  });
}
