import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import KanbanBoard from "./ui/KanbanBoard";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "Tickets - Asset Tracker",
  description: "Manage user tickets and requests",
};

async function getTickets() {
  const rawTickets = await prisma.tickets.findMany({
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
  return rawTickets.map((ticket) => ({
    ...ticket,
    creator: ticket.user_tickets_createdByTouser,
    assignee: ticket.user_tickets_assignedToTouser,
    comments: ticket.ticket_comments,
  }));
}

async function getAdminUsers() {
  return await prisma.user.findMany({
    where: {
      isadmin: true,
    },
    select: {
      userid: true,
      username: true,
      firstname: true,
      lastname: true,
    },
    orderBy: {
      firstname: 'asc',
    },
  });
}

export default async function TicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!session.user.isAdmin) {
    redirect("/");
  }

  const tickets = await getTickets();
  const adminUsers = await getAdminUsers();

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Admin", href: "/admin" },
          { label: "Tickets" },
        ]}
      />
      <div className="mt-6">
        <h1 className="text-3xl font-bold mb-6">Ticket Management</h1>
        <KanbanBoard tickets={tickets} adminUsers={adminUsers} />
      </div>
    </div>
  );
}
