"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Monitor, Smartphone, Globe, Clock, Trash2, RefreshCw, ShieldAlert } from "lucide-react";

interface SessionInfo {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  deviceName: string | null;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString();
}

function getDeviceIcon(deviceName: string | null) {
  if (!deviceName) return <Monitor className="h-5 w-5 text-muted-foreground" />;
  const lower = deviceName.toLowerCase();
  if (lower.includes("iphone") || lower.includes("android")) {
    return <Smartphone className="h-5 w-5 text-muted-foreground" />;
  }
  return <Monitor className="h-5 w-5 text-muted-foreground" />;
}

export default function SessionManagement() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/auth/sessions");
      if (!res.ok) {
        throw new Error("Failed to fetch sessions");
      }
      const data = await res.json();
      setSessions(data.sessions || []);
    } catch (err) {
      toast.error("Failed to load sessions", {
        description: (err as Error).message,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/auth/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to revoke session");
      }
      toast.success("Session revoked");
      await fetchSessions();
    } catch (err) {
      toast.error("Failed to revoke session", {
        description: (err as Error).message,
      });
    } finally {
      setRevokingId(null);
    }
  };

  const handleRevokeAll = async () => {
    const currentSession = sessions.find((s) => s.isCurrent);
    if (!currentSession) {
      toast.error("Could not identify current session");
      return;
    }

    setRevokingAll(true);
    try {
      const res = await fetch("/api/auth/sessions/revoke-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentSessionId: currentSession.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to revoke sessions");
      }
      const data = await res.json();
      toast.success(`Revoked ${data.revokedCount} session${data.revokedCount === 1 ? "" : "s"}`);
      await fetchSessions();
    } catch (err) {
      toast.error("Failed to revoke sessions", {
        description: (err as Error).message,
      });
    } finally {
      setRevokingAll(false);
    }
  };

  const otherSessionCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Active Sessions
            </CardTitle>
            <CardDescription className="mt-1">
              Manage your active sessions across devices. Revoke any session you
              don&apos;t recognize.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchSessions}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No active sessions found.
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-start gap-3">
                    {getDeviceIcon(session.deviceName)}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {session.deviceName || "Unknown Device"}
                        </span>
                        {session.isCurrent && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {session.ipAddress && (
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {session.ipAddress}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Last active: {formatRelativeTime(session.lastActive)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Created: {formatRelativeTime(session.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  {!session.isCurrent && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRevoke(session.id)}
                      disabled={revokingId === session.id}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      {revokingId === session.id ? "Revoking..." : "Revoke"}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {otherSessionCount > 0 && (
              <div className="mt-4 pt-4 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleRevokeAll}
                  disabled={revokingAll}
                >
                  {revokingAll
                    ? "Revoking..."
                    : `Revoke all other sessions (${otherSessionCount})`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
