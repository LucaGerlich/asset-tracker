"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Search, UserPlus, Shield, ShieldOff, Trash2, Edit } from "lucide-react";

interface UsersSettingsTabProps {
  users: Array<{
    userid: string;
    username: string | null;
    firstname: string;
    lastname: string;
    email: string | null;
    isadmin: boolean;
    canrequest: boolean;
    creation_date: Date;
  }>;
}

export default function UsersSettingsTab({ users: initialUsers }: UsersSettingsTabProps) {
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const filteredUsers = users.filter(
    (user) =>
      user.firstname.toLowerCase().includes(search.toLowerCase()) ||
      user.lastname.toLowerCase().includes(search.toLowerCase()) ||
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.username?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUserSelection = (userId: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const toggleAllSelection = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map((u) => u.userid)));
    }
  };

  const handleToggleAdmin = async (userId: string, makeAdmin: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isadmin: makeAdmin }),
      });

      if (response.ok) {
        setUsers(users.map((u) => (u.userid === userId ? { ...u, isadmin: makeAdmin } : u)));
        toast.success(`User ${makeAdmin ? "promoted to" : "removed from"} admin`);
      } else {
        toast.error("Failed to update user permissions");
      }
    } catch (error) {
      toast.error("Failed to update user permissions");
    }
  };

  const handleToggleRequest = async (userId: string, canRequest: boolean) => {
    try {
      const response = await fetch(`/api/admin/users/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canrequest: canRequest }),
      });

      if (response.ok) {
        setUsers(users.map((u) => (u.userid === userId ? { ...u, canrequest: canRequest } : u)));
        toast.success(`User request permission ${canRequest ? "granted" : "revoked"}`);
      } else {
        toast.error("Failed to update user permissions");
      }
    } catch (error) {
      toast.error("Failed to update user permissions");
    }
  };

  const handleBulkAction = async (action: "makeAdmin" | "removeAdmin" | "enableRequest" | "disableRequest") => {
    const updates: Record<string, boolean> = {};
    
    switch (action) {
      case "makeAdmin":
        updates.isadmin = true;
        break;
      case "removeAdmin":
        updates.isadmin = false;
        break;
      case "enableRequest":
        updates.canrequest = true;
        break;
      case "disableRequest":
        updates.canrequest = false;
        break;
    }

    try {
      const response = await fetch("/api/admin/users/bulk-permissions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userIds: Array.from(selectedUsers),
          updates,
        }),
      });

      if (response.ok) {
        setUsers(
          users.map((u) =>
            selectedUsers.has(u.userid) ? { ...u, ...updates } : u
          )
        );
        setSelectedUsers(new Set());
        toast.success("User permissions updated successfully");
      } else {
        toast.error("Failed to update user permissions");
      }
    } catch (error) {
      toast.error("Failed to update user permissions");
    }
  };

  const adminCount = users.filter((u) => u.isadmin).length;
  const requestersCount = users.filter((u) => u.canrequest).length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{users.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Administrators
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{adminCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Can Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requestersCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Management</CardTitle>
          <CardDescription>
            Manage user permissions and access levels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {selectedUsers.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {selectedUsers.size} selected
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("makeAdmin")}
                >
                  <Shield className="h-4 w-4 mr-1" />
                  Make Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("removeAdmin")}
                >
                  <ShieldOff className="h-4 w-4 mr-1" />
                  Remove Admin
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("enableRequest")}
                >
                  Enable Request
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("disableRequest")}
                >
                  Disable Request
                </Button>
              </div>
            )}
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={
                        filteredUsers.length > 0 &&
                        selectedUsers.size === filteredUsers.length
                      }
                      onCheckedChange={toggleAllSelection}
                    />
                  </TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow key={user.userid}>
                    <TableCell>
                      <Checkbox
                        checked={selectedUsers.has(user.userid)}
                        onCheckedChange={() => toggleUserSelection(user.userid)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {user.firstname} {user.lastname}
                        </span>
                        {user.username && (
                          <span className="text-sm text-muted-foreground">
                            @{user.username}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{user.email || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {user.isadmin && (
                          <Badge variant="default">Admin</Badge>
                        )}
                        {user.canrequest && (
                          <Badge variant="secondary">Can Request</Badge>
                        )}
                        {!user.isadmin && !user.canrequest && (
                          <Badge variant="outline">Standard</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(user.creation_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleAdmin(user.userid, !user.isadmin)
                          }
                        >
                          {user.isadmin ? (
                            <ShieldOff className="h-4 w-4" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleToggleRequest(user.userid, !user.canrequest)
                          }
                        >
                          {user.canrequest ? "Disable" : "Enable"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <p className="text-muted-foreground">No users found</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
