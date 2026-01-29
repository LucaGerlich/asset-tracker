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
  return await prisma.ticket.findMany({
    where: {
      createdBy: userId,
    },
    include: {
      creator: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
          email: true,
        },
      },
      assignee: {
        select: {
          userid: true,
          username: true,
          firstname: true,
          lastname: true,
          email: true,
        },
      },
      comments: {
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
        items={[
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
