import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Breadcrumb from "@/components/Breadcrumb";
import UserTicketsPage from "./ui/UserTicketsPage";
import prisma from "@/lib/prisma";

export const metadata = {
  title: "My Tickets - Asset Tracker",
  description: "View and manage your support tickets",
};

async function getUserTickets(userId: string) {
  const rawTickets = await prisma.tickets.findMany({
    where: {
      createdBy: userId,
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

export default async function TicketsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const tickets = await getUserTickets(session.user.id!);

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "My Tickets" },
        ]}
      />
      <div className="mt-6">
        <h1 className="text-3xl font-bold mb-6">My Tickets</h1>
        <UserTicketsPage tickets={tickets} />
      </div>
    </div>
  );
}
