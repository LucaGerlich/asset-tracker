"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

interface Invitation {
  id: string;
  email: string;
  status: string;
  roleId: string | null;
  role: { name: string } | null;
  inviter: { firstname: string; lastname: string };
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
}

interface Role {
  id: string;
  name: string;
}

function StatusBadge({
  status,
  expiresAt,
}: {
  status: string;
  expiresAt: string;
}) {
  const isExpired = status === "pending" && new Date() > new Date(expiresAt);
  const displayStatus = isExpired ? "expired" : status;

  const variants: Record<string, { className: string; label: string }> = {
    pending: {
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
      label: "Pending",
    },
    accepted: {
      className: "bg-green-100 text-green-800 border-green-200",
      label: "Accepted",
    },
    expired: {
      className: "bg-gray-100 text-gray-800 border-gray-200",
      label: "Expired",
    },
    revoked: {
      className: "bg-red-100 text-red-800 border-red-200",
      label: "Revoked",
    },
  };

  const variant = variants[displayStatus] || variants.pending;

  return (
    <Badge variant="outline" className={variant.className}>
      {variant.label}
    </Badge>
  );
}

export default function TeamInvitationsClient() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const fetchInvitations = useCallback(async () => {
    try {
      const response = await fetch("/api/team/invite");
      if (response.ok) {
        const data = await response.json();
        setInvitations(data);
      } else {
        toast.error("Failed to load invitations");
      }
    } catch {
      toast.error("Failed to load invitations");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/roles");
      if (response.ok) {
        const data = await response.json();
        setRoles(Array.isArray(data) ? data : data.roles || []);
      }
    } catch {
      // Roles are optional, fail silently
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
    fetchRoles();
  }, [fetchInvitations, fetchRoles]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch("/api/team/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          roleId: selectedRoleId || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Failed to send invitation");
        return;
      }

      toast.success(`Invitation sent to ${email}`);
      setDialogOpen(false);
      setEmail("");
      setSelectedRoleId("");
      fetchInvitations();
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRevoke(invitationId: string) {
    try {
      const response = await fetch(`/api/team/invite`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: invitationId, status: "revoked" }),
      });

      if (!response.ok) {
        toast.error("Failed to revoke invitation");
        return;
      }

      toast.success("Invitation revoked");
      fetchInvitations();
    } catch {
      toast.error("Failed to revoke invitation");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Management</h1>
          <p className="text-muted-foreground">
            Invite and manage team members
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="w-fit">
          Invite User
        </Button>
      </div>

      <div className="rounded-md border">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Invited By</TableHead>
              <TableHead>Sent</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invitations.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-muted-foreground py-8 text-center"
                >
                  No invitations yet. Click &quot;Invite User&quot; to get
                  started.
                </TableCell>
              </TableRow>
            ) : (
              invitations.map((invitation) => {
                const isPending =
                  invitation.status === "pending" &&
                  new Date() <= new Date(invitation.expiresAt);

                return (
                  <TableRow key={invitation.id}>
                    <TableCell>{invitation.email}</TableCell>
                    <TableCell>
                      {invitation.role?.name || (
                        <span className="text-muted-foreground">--</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={invitation.status}
                        expiresAt={invitation.expiresAt}
                      />
                    </TableCell>
                    <TableCell>
                      {invitation.inviter.firstname}{" "}
                      {invitation.inviter.lastname}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(invitation.expiresAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {isPending && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRevoke(invitation.id)}
                        >
                          Revoke
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User</DialogTitle>
            <DialogDescription>
              Send an invitation email to add a new team member.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="invite-email">Email Address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@example.com"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="invite-role">Role (optional)</Label>
                <Select
                  value={selectedRoleId}
                  onValueChange={setSelectedRoleId}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Sending..." : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
