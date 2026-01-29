"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, User } from "lucide-react";
import { Ticket } from "@/types/ticket";

interface TicketCardProps {
  ticket: Ticket;
  onClick: () => void;
}

const PRIORITY_COLORS = {
  low: "bg-gray-100 text-gray-800 border-gray-300",
  medium: "bg-blue-100 text-blue-800 border-blue-300",
  high: "bg-orange-100 text-orange-800 border-orange-300",
  urgent: "bg-red-100 text-red-800 border-red-300",
};

export function TicketCard({ ticket, onClick }: TicketCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: ticket.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const priorityColor =
    PRIORITY_COLORS[ticket.priority as keyof typeof PRIORITY_COLORS] ||
    PRIORITY_COLORS.medium;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`cursor-pointer rounded-lg border bg-card p-4 shadow-sm transition-all hover:shadow-md ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <h4 className="font-medium text-sm line-clamp-2">{ticket.title}</h4>
        <span
          className={`ml-2 rounded-full border px-2 py-0.5 text-xs font-medium ${priorityColor}`}
        >
          {ticket.priority}
        </span>
      </div>

      {ticket.description && (
        <p className="mb-3 text-xs text-muted-foreground line-clamp-2">
          {ticket.description}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span>
            {ticket.creator.firstname} {ticket.creator.lastname}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
        </div>
      </div>

      {ticket.assignee && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <span className="text-muted-foreground">Assigned to:</span>
          <span className="font-medium">
            {ticket.assignee.firstname} {ticket.assignee.lastname}
          </span>
        </div>
      )}
    </div>
  );
}
