"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface InviteAcceptFormProps {
  token: string;
  email: string;
}

export default function InviteAcceptForm({
  token,
  email,
}: InviteAcceptFormProps) {
  const router = useRouter();
  const [firstname, setFirstname] = useState("");
  const [lastname, setLastname] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/team/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstname, lastname, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      router.push(
        "/login?message=Invitation accepted successfully. Please sign in.",
      );
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          disabled
          className="bg-muted mt-1"
        />
      </div>
      <div>
        <Label htmlFor="firstname">First Name</Label>
        <Input
          id="firstname"
          type="text"
          value={firstname}
          onChange={(e) => setFirstname(e.target.value)}
          required
          placeholder="Enter your first name"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="lastname">Last Name</Label>
        <Input
          id="lastname"
          type="text"
          value={lastname}
          onChange={(e) => setLastname(e.target.value)}
          required
          placeholder="Enter your last name"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder="At least 8 characters"
          className="mt-1"
        />
      </div>
      <div>
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <Input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          placeholder="Confirm your password"
          className="mt-1"
        />
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Accepting..." : "Accept Invitation"}
      </Button>
    </form>
  );
}
