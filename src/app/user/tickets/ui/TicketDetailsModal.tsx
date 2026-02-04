"use client";

import { useState } from "react";
import { MessageSquare, User, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Ticket } from "@/types/ticket";

interface TicketDetailsModalProps {
  ticket: Ticket;
  onClose: () => void;
  onAddComment: (ticketId: string, comment: string) => Promise<any>;
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

export function TicketDetailsModal({
  ticket,
  onClose,
  onAddComment,
}: TicketDetailsModalProps) {
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const status = STATUS_CONFIG[ticket.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.new;
  const priority = PRIORITY_CONFIG[ticket.priority as keyof typeof PRIORITY_CONFIG] || PRIORITY_CONFIG.medium;

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment(ticket.id, newComment);
      setNewComment("");
      toast.success("Comment added");
    } catch (error) {
      toast.error("Failed to add comment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <DialogTitle className="text-xl font-bold pr-8">{ticket.title}</DialogTitle>
            <div className="flex gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${priority.color}`}>
                {ticket.priority}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-xs font-medium whitespace-nowrap ${status.color}`}>
                {status.label}
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Description */}
          <div>
            <Label className="text-sm font-medium text-muted-foreground">Description</Label>
            <p className="mt-1 text-sm">
              {ticket.description || "No description provided"}
            </p>
          </div>

          {/* Metadata */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Created:</span>
              <span className="font-medium">
                {new Date(ticket.createdAt).toLocaleString()}
              </span>
            </div>
          </div>

          {ticket.assignee && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Assigned to:</span>
              <span className="font-medium">
                {ticket.assignee.firstname} {ticket.assignee.lastname}
              </span>
            </div>
          )}

          {/* Comments Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="h-4 w-4" />
              <Label className="text-base font-semibold">
                Comments ({ticket.comments.length})
              </Label>
            </div>

            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {ticket.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No comments yet</p>
              ) : (
                ticket.comments.map((comment) => (
                  <div
                    key={comment.id}
                    className="rounded-lg border bg-muted/50 p-3 text-sm"
                  >
                    <div className="flex items-start justify-between mb-1">
                      <span className="font-medium">
                        {comment.user.firstname} {comment.user.lastname}
                      </span>
                      <span className="text-xs text-muted-foreground">
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
