"use client";

import { useState } from "react";
import { MessageSquare, User, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Ticket } from "@/types/ticket";

interface AdminUser {
  userid: string;
  username: string | null;
  firstname: string;
  lastname: string;
}

interface TicketModalProps {
  ticket: Ticket;
  adminUsers: AdminUser[];
  onClose: () => void;
  onUpdate: (ticketId: string, updates: Partial<Ticket>) => Promise<any>;
  onAddComment: (ticketId: string, comment: string) => Promise<any>;
}

const STATUSES = [
  { value: "new", label: "New" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function TicketModal({
  ticket,
  adminUsers,
  onClose,
  onUpdate,
  onAddComment,
}: TicketModalProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    await onUpdate(ticket.id, { status: newStatus });
  };

  const handlePriorityChange = async (newPriority: string) => {
    await onUpdate(ticket.id, { priority: newPriority });
  };

  const handleAssigneeChange = async (userId: string) => {
    await onUpdate(ticket.id, { assignedTo: userId || null });
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(ticket.id, newComment);
      setNewComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            {ticket.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <Label className="text-muted-foreground text-sm font-medium">
              Description
            </Label>
            <p className="mt-1 text-sm">
              {ticket.description || "No description provided"}
            </p>
          </div>

          {/* Creator Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">Created by:</span>
              <span className="font-medium">
                {ticket.creator.firstname} {ticket.creator.lastname}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground h-4 w-4" />
              <span className="text-muted-foreground">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {/* Status, Priority, Assignee Controls */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={ticket.status} onValueChange={handleStatusChange}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select
                value={ticket.priority}
                onValueChange={handlePriorityChange}
              >
                <SelectTrigger id="priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="assignee">Assign To</Label>
              <Select
                value={ticket.assignedTo || "unassigned"}
                onValueChange={handleAssigneeChange}
              >
                <SelectTrigger id="assignee">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {adminUsers.map((admin) => (
                    <SelectItem key={admin.userid} value={admin.userid}>
                      {admin.firstname} {admin.lastname}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Comments Section */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <Label className="text-base font-semibold">
                Comments ({ticket.comments.length})
              </Label>
            </div>

            <div className="mb-4 max-h-64 space-y-3 overflow-y-auto">
              {ticket.comments.length === 0 ? (
                <p className="text-muted-foreground text-sm italic">
                  No comments yet
                </p>
              ) : (
                ticket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="bg-muted/50 rounded-lg border p-3 text-sm"
                  >
                    <div className="mb-1 flex items-start justify-between">
                      <span className="font-medium">
                        {comment.user.firstname} {comment.user.lastname}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {new Date(comment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{comment.comment}</p>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={!newComment.trim() || isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Comment"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
