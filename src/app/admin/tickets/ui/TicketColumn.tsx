"use client";

import { useDroppable } from "@dnd-kit/core";
import { TicketCard } from "./TicketCard";
import { Ticket } from "@/types/ticket";

interface TicketColumnProps {
  id: string;
  label: string;
  color: string;
  tickets: Ticket[];
  onTicketClick: (ticket: Ticket) => void;
}

export function TicketColumn({ id, label, color, tickets, onTicketClick }: TicketColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-lg border bg-card p-4 transition-colors ${
        isOver ? "border-primary bg-accent" : "border-border"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-3 w-3 rounded-full ${color}`} />
          <h3 className="font-semibold">{label}</h3>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
          {tickets.length}
        </span>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto">
        {tickets.map((ticket) => (
          <TicketCard
            key={ticket.id}
            ticket={ticket}
            onClick={() => onTicketClick(ticket)}
          />
        ))}
        {tickets.length === 0 && (
          <div className="flex items-center justify-center rounded-md border-2 border-dashed border-muted-foreground/25 p-8 text-center">
            <p className="text-sm text-muted-foreground">No tickets</p>
          </div>
        )}
      </div>
    </div>
  );
}
