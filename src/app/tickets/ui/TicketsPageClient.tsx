"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Loader2,
  RefreshCw,
  Search,
  Ticket,
  AlertCircle,
  ExternalLink,
  Settings,
} from "lucide-react";
import Link from "next/link";
import {
  type FreshdeskTicket,
  FreshdeskTicketStatus,
  FreshdeskTicketPriority,
  getStatusLabel,
  getPriorityLabel,
  getStatusColor,
  getPriorityColor,
  SUPPORTED_TICKET_TYPES,
} from "@/lib/freshdesk";

interface TicketsPageClientProps {
  isAdmin: boolean;
}

export default function TicketsPageClient({ isAdmin }: TicketsPageClientProps) {
  const [tickets, setTickets] = useState<FreshdeskTicket[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<FreshdeskTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const fetchTickets = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/tickets");
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to fetch tickets");
        setTickets([]);
        return;
      }

      setTickets(data.tickets || []);
    } catch {
      setError("Failed to connect to the server");
      setTickets([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  // Apply filters
  useEffect(() => {
    let result = [...tickets];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (ticket) =>
          ticket.subject.toLowerCase().includes(query) ||
          ticket.description_text?.toLowerCase().includes(query) ||
          String(ticket.id).includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter(
        (ticket) => ticket.status === parseInt(statusFilter, 10)
      );
    }

    // Type filter
    if (typeFilter !== "all") {
      result = result.filter((ticket) => ticket.type === typeFilter);
    }

    // Priority filter
    if (priorityFilter !== "all") {
      result = result.filter(
        (ticket) => ticket.priority === parseInt(priorityFilter, 10)
      );
    }

    setFilteredTickets(result);
  }, [tickets, searchQuery, statusFilter, typeFilter, priorityFilter]);

  const handleRefresh = () => {
    toast.info("Refreshing tickets...");
    fetchTickets();
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Ticket className="h-6 w-6" />
              IT Tickets
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Hardware Requests and Problems from Freshdesk
            </p>
          </div>
        </div>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Unable to load tickets</AlertTitle>
          <AlertDescription className="mt-2">
            <p>{error}</p>
            {isAdmin && error.includes("not configured") && (
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href="/admin/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Configure Freshdesk
                </Link>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Ticket className="h-6 w-6" />
            IT Tickets
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Hardware Requests and Problems from Freshdesk
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2 hidden sm:inline">Refresh</span>
          </Button>
          {isAdmin && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/settings">
                <Settings className="h-4 w-4" />
                <span className="ml-2 hidden sm:inline">Settings</span>
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {SUPPORTED_TICKET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value={String(FreshdeskTicketStatus.Open)}>
                    Open
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketStatus.Pending)}>
                    Pending
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketStatus.Resolved)}>
                    Resolved
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketStatus.Closed)}>
                    Closed
                  </SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value={String(FreshdeskTicketPriority.Low)}>
                    Low
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketPriority.Medium)}>
                    Medium
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketPriority.High)}>
                    High
                  </SelectItem>
                  <SelectItem value={String(FreshdeskTicketPriority.Urgent)}>
                    Urgent
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredTickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Ticket className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No tickets found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {tickets.length === 0
                ? "There are no Hardware Request or Problem tickets in Freshdesk"
                : "Try adjusting your filters"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Showing {filteredTickets.length} of {tickets.length} tickets
          </p>
          {filteredTickets.map((ticket) => (
            <TicketCard key={ticket.id} ticket={ticket} />
          ))}
        </div>
      )}
    </div>
  );
}

interface TicketCardProps {
  ticket: FreshdeskTicket;
}

function TicketCard({ ticket }: TicketCardProps) {
  const createdDate = new Date(ticket.created_at).toLocaleDateString();
  const updatedDate = new Date(ticket.updated_at).toLocaleDateString();

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-medium leading-tight">
              <span className="text-muted-foreground mr-2">#{ticket.id}</span>
              {ticket.subject}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              {ticket.type && (
                <Badge variant="outline" className="text-xs">
                  {ticket.type}
                </Badge>
              )}
              <span className="text-xs">Created: {createdDate}</span>
              <span className="text-xs">Updated: {updatedDate}</span>
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={getStatusColor(ticket.status)}>
              {getStatusLabel(ticket.status)}
            </Badge>
            <Badge className={getPriorityColor(ticket.priority)}>
              {getPriorityLabel(ticket.priority)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <Separator />
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {ticket.description_text || "No description provided"}
        </p>
        {ticket.tags && ticket.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {ticket.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
