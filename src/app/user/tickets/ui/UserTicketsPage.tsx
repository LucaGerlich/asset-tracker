"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewTicketForm } from "./NewTicketForm";
import { TicketList } from "./TicketList";
import { TicketDetailsModal } from "./TicketDetailsModal";
import { Ticket } from "@/types/ticket";

interface UserTicketsPageProps {
  tickets: Ticket[];
}

export default function UserTicketsPage({ tickets: initialTickets }: UserTicketsPageProps) {
  const [tickets, setTickets] = useState<Ticket[]>(initialTickets);
  const [showNewTicketForm, setShowNewTicketForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  const handleTicketCreated = (newTicket: Ticket) => {
    setTickets([newTicket, ...tickets]);
    setShowNewTicketForm(false);
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

      return newComment;
    } catch (error) {
      console.error("Error adding comment:", error);
      throw error;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with New Ticket Button */}
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">
          Submit and track your support requests
        </p>
        <Button onClick={() => setShowNewTicketForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* New Ticket Form */}
      {showNewTicketForm && (
        <NewTicketForm
          onTicketCreated={handleTicketCreated}
          onCancel={() => setShowNewTicketForm(false)}
        />
      )}

      {/* Tickets List */}
      <TicketList
        tickets={tickets}
        onTicketClick={(ticket) => setSelectedTicket(ticket)}
      />

      {/* Ticket Details Modal */}
      {selectedTicket && (
        <TicketDetailsModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onAddComment={handleAddComment}
        />
      )}
    </div>
  );
}
