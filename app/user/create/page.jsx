"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { Toaster, toast } from "sonner";

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

  // Debounced username validation
  useEffect(() => {
    const handle = setTimeout(async () => {
      if (!form.username) {
        setUsernameTaken(false);
        return;
      }
      try {
        const res = await fetch(`/api/user/validate?username=${encodeURIComponent(form.username)}`);
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
        const res = await fetch(`/api/user/validate?email=${encodeURIComponent(form.email)}`);
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

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/user/addUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to create user");
      }
      const created = await res.json();
      toast.success("User created", { description: created.username ?? created.userid });
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
      <Toaster position="bottom-right" />
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Create User</h1>
            <p className="text-sm text-foreground-500 mt-1">Fill out details below</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="light" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={submitting}>{submitting ? "Creating..." : "Create"}</Button>
          </div>
        </div>
        <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Profile</h2>
                <div className="grid grid-cols-1 gap-3">
                  <Input name="firstname" value={form.firstname} onChange={onChange} placeholder="First Name" required />
                  <Input name="lastname" value={form.lastname} onChange={onChange} placeholder="Last Name" required />
                  <Input
                    placeholder="Username"
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    aria-invalid={usernameTaken}
                  />
                  <Input name="lan" value={form.lan} onChange={onChange} placeholder="Language" />
                </div>
              </section>

              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Contact</h2>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    aria-invalid={emailTaken}
                  />
                </div>
              </section>

              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Permissions</h2>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setForm((f) => ({ ...f, isadmin: false, canrequest: false }))}>Deactivated</Button>
                    <Button size="sm" onClick={() => setForm((f) => ({ ...f, isadmin: false, canrequest: true }))}>Requester</Button>
                    <Button size="sm" onClick={() => setForm((f) => ({ ...f, isadmin: true, canrequest: true }))}>Admin</Button>
                  </div>
                  <div className="flex gap-6">
                    <Checkbox checked={form.isadmin} onChange={(e) => setForm((f) => ({ ...f, isadmin: e.target.checked }))}>Admin</Checkbox>
                    <Checkbox checked={form.canrequest} onChange={(e) => setForm((f) => ({ ...f, canrequest: e.target.checked }))}>Can Request</Checkbox>
                  </div>
                </div>
              </section>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Security</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input name="password" type="password" value={form.password} onChange={onChange} required placeholder="Password" />
            </div>
          </section>
        </div>

        {(error || usernameTaken || emailTaken) && (
          <p className="text-red-500 text-sm">
            {error || (usernameTaken && "Username already exists") || (emailTaken && "Email already exists")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="light" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={submitting || usernameTaken || emailTaken}>{submitting ? "Creating..." : "Create"}</Button>
        </div>
      </form>
    </div>
  );
}
