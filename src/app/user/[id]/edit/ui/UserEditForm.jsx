"use client";
import React, { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

export default function UserEditForm({ initial }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [usernameTaken, setUsernameTaken] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [form, setForm] = useState({
    userid: initial.userid,
    firstname: initial.firstname ?? "",
    lastname: initial.lastname ?? "",
    username: initial.username ?? "",
    email: initial.email ?? "",
    lan: initial.lan ?? "",
    isadmin: Boolean(initial.isadmin),
    canrequest: Boolean(initial.canrequest),
    password: "",
  });
  const [isDirty, setIsDirty] = useState(false);
  const initialSnapshot = useMemo(() => JSON.stringify({
    firstname: initial.firstname ?? "",
    lastname: initial.lastname ?? "",
    username: initial.username ?? "",
    email: initial.email ?? "",
    lan: initial.lan ?? "",
    isadmin: Boolean(initial.isadmin),
    canrequest: Boolean(initial.canrequest),
    password: "",
  }), [initial]);

  useEffect(() => {
    setIsDirty(JSON.stringify({ ...form }) !== initialSnapshot);
  }, [form, initialSnapshot]);

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  // Debounced username validation (exclude current user)
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!form.username || form.username === (initial.username ?? "")) {
        setUsernameTaken(false);
        return;
      }
      try {
        const res = await fetch(`/api/user/validate?username=${encodeURIComponent(form.username)}&excludeId=${encodeURIComponent(initial.userid)}`);
        const data = await res.json();
        setUsernameTaken(Boolean(data?.username?.exists));
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.username, initial.username, initial.userid]);

  // Debounced email validation (exclude current user)
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!form.email || form.email === (initial.email ?? "")) {
        setEmailTaken(false);
        return;
      }
      try {
        const res = await fetch(`/api/user/validate?email=${encodeURIComponent(form.email)}&excludeId=${encodeURIComponent(initial.userid)}`);
        const data = await res.json();
        setEmailTaken(Boolean(data?.email?.exists));
      } catch {
        // ignore
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [form.email, initial.email, initial.userid]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const body = { ...form };
      if (!body.password) delete body.password;
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update user");
      }
      const updated = await res.json();
      toast.success("User updated", { description: updated.email || updated.username || "" });
      router.push(`/user/${updated.userid}`);
    } catch (e) {
      setError(e.message);
      toast.error("Update failed", { description: e.message });
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (!isDirty || confirm("Discard unsaved changes?")) {
      router.back();
    }
  };

  return (
    <div className="max-w-4xl">
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Edit: {initial.firstname} {initial.lastname}</h1>
            <p className="text-sm text-foreground-500 mt-1">{initial.email || "No email"}{initial.username ? ` • @${initial.username}` : ""}</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button type="button" variant="ghost" onClick={handleCancel} className="w-full sm:w-auto">Cancel</Button>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">{saving ? "Saving..." : "Save"}</Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Profile</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="firstname">First Name *</Label>
                <Input id="firstname" name="firstname" value={form.firstname} onChange={onChange} required />
              </div>
              <div>
                <Label htmlFor="lastname">Last Name *</Label>
                <Input id="lastname" name="lastname" value={form.lastname} onChange={onChange} required />
              </div>
              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={form.username}
                  onChange={onChange}
                  onBlur={async () => {
                    if (!form.username || form.username === (initial.username ?? "")) return;
                    try {
                      const res = await fetch(`/api/user/validate?username=${encodeURIComponent(form.username)}&excludeId=${encodeURIComponent(initial.userid)}`);
                      const data = await res.json();
                      setUsernameTaken(Boolean(data?.username?.exists));
                    } catch {}
                  }}
                  className={usernameTaken ? "border-destructive" : ""}
                />
                {usernameTaken && <p className="text-sm text-destructive mt-1">Username already exists</p>}
              </div>
              <div>
                <Label htmlFor="lan">Language</Label>
                <Input id="lan" name="lan" value={form.lan} onChange={onChange} />
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Contact</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={onChange}
                  onBlur={async () => {
                    if (!form.email || form.email === (initial.email ?? "")) return;
                    try {
                      const res = await fetch(`/api/user/validate?email=${encodeURIComponent(form.email)}&excludeId=${encodeURIComponent(initial.userid)}`);
                      const data = await res.json();
                      setEmailTaken(Boolean(data?.email?.exists));
                    } catch {}
                  }}
                  className={emailTaken ? "border-destructive" : ""}
                />
                {emailTaken && <p className="text-sm text-destructive mt-1">Email already exists</p>}
              </div>
            </div>
          </section>

          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Permissions</h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={!form.isadmin && !form.canrequest ? "default" : "outline"} onClick={() => setForm((f) => ({ ...f, isadmin: false, canrequest: false }))}>Deactivated</Button>
                <Button type="button" size="sm" variant={!form.isadmin && form.canrequest ? "default" : "outline"} onClick={() => setForm((f) => ({ ...f, isadmin: false, canrequest: true }))}>Requester</Button>
                <Button type="button" size="sm" variant={form.isadmin ? "default" : "outline"} onClick={() => setForm((f) => ({ ...f, isadmin: true, canrequest: true }))}>Admin</Button>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center space-x-2">
                  <Checkbox id="isadmin" checked={form.isadmin} onCheckedChange={(v) => setForm((f) => ({ ...f, isadmin: v }))} />
                  <Label htmlFor="isadmin">Admin</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox id="canrequest" checked={form.canrequest} onCheckedChange={(v) => setForm((f) => ({ ...f, canrequest: v }))} />
                  <Label htmlFor="canrequest">Can Request</Label>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Security</h2>
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="password">Set New Password</Label>
                <Input id="password" name="password" type="password" value={form.password} onChange={onChange} placeholder="Leave blank to keep current" />
              </div>
            </div>
          </section>
        </div>

        {(error || usernameTaken || emailTaken) && (
          <p className="text-destructive text-sm" role="alert">
            {error || (usernameTaken && "Username already exists") || (emailTaken && "Email already exists")}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button type="button" variant="ghost" onClick={handleCancel} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" disabled={saving || usernameTaken || emailTaken} className="w-full sm:w-auto">{saving ? "Saving..." : "Save"}</Button>
        </div>
      </form>
    </div>
  );
}
