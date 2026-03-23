"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Copy, Check, RefreshCw, Mail, KeyRound, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";
import Breadcrumb from "@/components/Breadcrumb";

export default function Page() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstname: "",
    lastname: "",
    username: "",
    email: "",
    password: "",
    lan: "",
    isadmin: false,
    canrequest: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [passwordMode, setPasswordMode] = useState<
    "generate" | "manual" | "invite"
  >("generate");
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  // Debounced username validation
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!form.username) {
        setUsernameTaken(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/user/validate?username=${encodeURIComponent(form.username)}`,
        );
        const data = await res.json();
        setUsernameTaken(Boolean(data?.username?.exists));
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.username]);

  // Debounced email validation
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!form.email) {
        setEmailTaken(false);
        return;
      }
      try {
        const res = await fetch(
          `/api/user/validate?email=${encodeURIComponent(form.email)}`,
        );
        const data = await res.json();
        setEmailTaken(Boolean(data?.email?.exists));
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.email]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const generatePassword = () => {
    const chars =
      "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*";
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    const pwd = Array.from(array)
      .map((b) => chars[b % chars.length])
      .join("");
    setGeneratedPassword(pwd);
    setForm((f) => ({ ...f, password: pwd }));
    setCopied(false);
  };

  const copyPassword = async () => {
    if (generatedPassword) {
      await navigator.clipboard.writeText(generatedPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const payload =
        passwordMode === "invite"
          ? { ...form, password: undefined, passwordMode }
          : { ...form, passwordMode };
      const res = await fetch("/api/user/addUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create user");
      }
      const created = await res.json();
      if (created.magicLinkSent) {
        setMagicLinkSent(true);
        toast.success("User created", {
          description: `Magic link sent to ${form.email}`,
        });
      } else if (passwordMode === "invite") {
        toast.success("User created", {
          description: `Invitation sent to ${form.email}`,
        });
      } else {
        toast.success("User created", {
          description: created.username ?? created.userid,
        });
      }
      router.push(`/user`);
    } catch (err) {
      setError(err.message);
      toast.error("Create failed", { description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl">
      <Breadcrumb
        options={[
          { label: "Home", href: "/" },
          { label: "Users", href: "/user" },
          { label: "Create User" },
        ]}
      />
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              Create User
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Fill out details below
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="ghost"
              className="w-full sm:w-auto"
              onClick={() => router.back()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="w-full sm:w-auto"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Profile</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="firstname">First Name *</Label>
                <Input
                  id="firstname"
                  name="firstname"
                  value={form.firstname}
                  onChange={onChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastname">Last Name *</Label>
                <Input
                  id="lastname"
                  name="lastname"
                  value={form.lastname}
                  onChange={onChange}
                  required
                />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  className={usernameTaken ? "border-destructive" : ""}
                />
                {usernameTaken && (
                  <p className="text-destructive mt-1 text-sm">
                    Username already exists
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="lan">Language</Label>
                <Input
                  id="lan"
                  name="lan"
                  value={form.lan}
                  onChange={onChange}
                />
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Contact</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  className={emailTaken ? "border-destructive" : ""}
                />
                {emailTaken && (
                  <p className="text-destructive mt-1 text-sm">
                    Email already exists
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border p-4">
            <h2 className="mb-3 text-sm font-semibold">Permissions</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={
                    !form.isadmin && !form.canrequest ? "default" : "outline"
                  }
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      isadmin: false,
                      canrequest: false,
                    }))
                  }
                >
                  Deactivated
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={
                    !form.isadmin && form.canrequest ? "default" : "outline"
                  }
                  onClick={() =>
                    setForm((f) => ({ ...f, isadmin: false, canrequest: true }))
                  }
                >
                  Requester
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.isadmin ? "default" : "outline"}
                  onClick={() =>
                    setForm((f) => ({ ...f, isadmin: true, canrequest: true }))
                  }
                >
                  Admin
                </Button>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isadmin"
                    checked={form.isadmin}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, isadmin: Boolean(v) }))
                    }
                  />
                  <Label htmlFor="isadmin">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="canrequest"
                    checked={form.canrequest}
                    onCheckedChange={(v) =>
                      setForm((f) => ({ ...f, canrequest: Boolean(v) }))
                    }
                  />
                  <Label htmlFor="canrequest">Can Request</Label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
          <section className="col-span-1 rounded-lg border p-4 sm:col-span-2 lg:col-span-3">
            <h2 className="mb-3 text-sm font-semibold">Security</h2>
            <div className="grid grid-cols-1 gap-4">
              <RadioGroup
                value={passwordMode}
                onValueChange={(v) => {
                  setPasswordMode(v as "generate" | "manual" | "invite");
                  setGeneratedPassword(null);
                  setCopied(false);
                  if (v !== "manual") {
                    setForm((f) => ({ ...f, password: "" }));
                  }
                }}
                className="flex flex-wrap gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="generate" id="mode-generate" />
                  <Label
                    htmlFor="mode-generate"
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <KeyRound className="h-4 w-4" />
                    Generate password
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="manual" id="mode-manual" />
                  <Label
                    htmlFor="mode-manual"
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <KeyRound className="h-4 w-4" />
                    Set manually
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="invite" id="mode-invite" />
                  <Label
                    htmlFor="mode-invite"
                    className="flex cursor-pointer items-center gap-1.5"
                  >
                    <Send className="h-4 w-4" />
                    Invite only
                  </Label>
                </div>
              </RadioGroup>

              {passwordMode === "generate" && (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={generatePassword}
                    >
                      <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      Generate
                    </Button>
                  </div>
                  {generatedPassword && (
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={generatedPassword}
                        className="font-mono text-sm"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={copyPassword}
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  )}
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Mail className="h-3.5 w-3.5" />A magic link will be sent so
                    the user can set their own password.
                  </p>
                </div>
              )}

              {passwordMode === "manual" && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      value={form.password}
                      onChange={onChange}
                      required
                      minLength={8}
                    />
                  </div>
                  <p className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Mail className="h-3.5 w-3.5" />
                    If an email is provided, a magic link will also be sent.
                  </p>
                </div>
              )}

              {passwordMode === "invite" && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-sm">
                    No password will be set. The user will receive an invitation
                    email to set up their own account.
                  </p>
                  <p className="text-destructive text-xs">
                    Email address is required for invitation mode.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {(error || usernameTaken || emailTaken) && (
          <p className="text-destructive text-sm">
            {error ||
              (usernameTaken && "Username already exists") ||
              (emailTaken && "Email already exists")}
          </p>
        )}
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            className="w-full sm:w-auto"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="w-full sm:w-auto"
            disabled={
              submitting ||
              usernameTaken ||
              emailTaken ||
              (passwordMode === "manual" && !form.password) ||
              (passwordMode === "generate" && !generatedPassword) ||
              (passwordMode === "invite" && !form.email)
            }
          >
            {submitting ? "Creating..." : "Create"}
          </Button>
        </div>
      </form>
    </div>
  );
}
