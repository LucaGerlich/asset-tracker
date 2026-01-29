"use client";

import { useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { TicketColumn } from "./TicketColumn";
import { TicketCard } from "./TicketCard";
import { TicketModal } from "./TicketModal";
import { toast } from "sonner";

interface Creator {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
  email: string | null;
}

interface Assignee {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
  email: string | null;
}

interface Comment {
  id: string;
  comment: string;
  createdAt: Date;
  user: {
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
  };
}

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
  creator: Creator;
  assignee: Assignee | null;
  comments: Comment[];
}

interface AdminUser {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
}

interface KanbanBoardProps {
  tickets: Ticket[];
  adminUsers: AdminUser[];
}

const STATUSES = [
  { id: "new", label: "New", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-yellow-500" },
  { id: "completed", label: "Completed", color: "bg-green-500" },
];

export default function KanbanBoard({ tickets: initialTickets, adminUsers }: KanbanBoardProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [activeTicket, setActiveTicket] = useState<Ticket | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const ticket = tickets.find((t) => t.id === event.active.id);
    setActiveTicket(ticket || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTicket(null);

    if (!over || active.id === over.id) return;

    const ticketId = active.id as string;
    const newStatus = over.id as string;

    // Optimistic update
    setTickets((prevTickets) =>
      prevTickets.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
      )
    );

    // API call
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update ticket");
      }

      const updatedTicket = await response.json();
      
      // Update with server response
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === ticketId ? updatedTicket : ticket
        )
      );

      toast.success("Ticket status updated");
    } catch (error) {
      console.error("Error updating ticket:", error);
      // Revert on error
      setTickets(initialTickets);
      toast.error("Failed to update ticket status");
    }
  };

  const handleUpdateTicket = async (ticketId: string, updates: Partial<Ticket>) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error("Failed to update ticket");
      }

      const updatedTicket = await response.json();
      
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === ticketId ? updatedTicket : ticket
        )
      );

      toast.success("Ticket updated");
      return updatedTicket;
    } catch (error) {
      console.error("Error updating ticket:", error);
      toast.error("Failed to update ticket");
      throw error;
    }
  };

  const handleAddComment = async (ticketId: string, comment: string) => {
    try {
      const response = await fetch(`/api/tickets/${ticketId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ comment }),
      });

      if (!response.ok) {
        throw new Error("Failed to add comment");
      }

      const newComment = await response.json();
      
      // Update tickets with new comment
      setTickets((prevTickets) =>
        prevTickets.map((ticket) =>
          ticket.id === ticketId
            ? { ...ticket, comments: [...ticket.comments, newComment] }
            : ticket
        )
      );

      toast.success("Comment added");
      return newComment;
    } catch (error) {
      console.error("Error adding comment:", error);
      toast.error("Failed to add comment");
      throw error;
    }
  };

  const getTicketsByStatus = (status: string) => {
    return tickets.filter((ticket) => ticket.status === status);
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {STATUSES.map((status) => (
            <TicketColumn
              key={status.id}
              id={status.id}
              label={status.label}
              color={status.color}
              tickets={getTicketsByStatus(status.id)}
              onTicketClick={setSelectedTicket}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTicket ? (
            <div className="opacity-80">
              <TicketCard ticket={activeTicket} onClick={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedTicket && (
        <TicketModal
          ticket={selectedTicket}
          adminUsers={adminUsers}
          onClose={() => setSelectedTicket(null)}
          onUpdate={handleUpdateTicket}
          onAddComment={handleAddComment}
        />
      )}
    </>
  );
}
