"use client";

import { Clock, MessageSquare, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Ticket {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  createdBy: string;
  assignedTo: string | null;
  createdAt: Date;
  updatedAt: Date;
  creator: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
  };
  assignee: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
  } | null;
  comments: Array<any>;
}

interface TicketListProps {
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

const STATUS_CONFIG = {
  new: { label: "New", color: "bg-blue-100 text-blue-800 border-blue-300" },
  in_progress: { label: "In Progress", color: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  completed: { label: "Completed", color: "bg-green-100 text-green-800 border-green-300" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-800 border-gray-300" },
};

const PRIORITY_CONFIG = {
  low: { color: "bg-gray-100 text-gray-800 border-gray-300" },
  medium: { color: "bg-blue-100 text-blue-800 border-blue-300" },
  high: { color: "bg-orange-100 text-orange-800 border-orange-300" },
  urgent: { color: "bg-red-100 text-red-800 border-red-300" },
};

export function TicketList({ tickets, onTicketClick }: TicketListProps) {
  if (tickets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="text-muted-foreground">
          No tickets yet. Create your first ticket to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tickets.map((ticket) => {
        const status = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
        const priority = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

        return (
          <div
            key={ticket.id}
            onClick={() => onTicketClick(ticket)}
            className="cursor-pointer rounded-lg border bg-card p-4 transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-semibold text-lg">{ticket.title}</h3>
              <div className="flex gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${priority.color}`}>
                  {ticket.priority}
                </span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${status.color}`}>
                  {status.label}
                </span>
              </div>
            </div>

            {ticket.description && (
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {ticket.description}
              </p>
            )}

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                </div>
                {ticket.comments.length > 0 && (
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    <span>{ticket.comments.length} comment{ticket.comments.length !== 1 ? 's' : ''}</span>
                  </div>
                )}
              </div>
              {ticket.assignee && (
                <div className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  <span>Assigned to: {ticket.assignee.firstname} {ticket.assignee.lastname}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
