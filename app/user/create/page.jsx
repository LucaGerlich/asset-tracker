"use client";
import React, { useState, useEffect } from "react";
import { Button, Input, Checkbox, Divider } from "@heroui/react";
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold">Create User</h1>
            <p className="text-sm text-foreground-500 mt-1">Fill out details below</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <Button type="button" variant="light" onPress={() => router.back()} className="w-full sm:w-auto">Cancel</Button>
            <Button color="primary" type="submit" isLoading={submitting} className="w-full sm:w-auto">Create</Button>
          </div>
        </div>
        <Divider />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Profile</h2>
                <div className="grid grid-cols-1 gap-3">
                  <Input label="First Name" name="firstname" value={form.firstname} onChange={onChange} isRequired />
                  <Input label="Last Name" name="lastname" value={form.lastname} onChange={onChange} isRequired />
                  <Input
                    label="Username"
                    name="username"
                    value={form.username}
                    onChange={onChange}
                    isInvalid={usernameTaken}
                    errorMessage={usernameTaken ? "Username already exists" : undefined}
                  />
                  <Input label="Language" name="lan" value={form.lan} onChange={onChange} />
                </div>
              </section>

              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Contact</h2>
                <div className="grid grid-cols-1 gap-3">
                  <Input
                    label="Email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={onChange}
                    isInvalid={emailTaken}
                    errorMessage={emailTaken ? "Email already exists" : undefined}
                  />
                </div>
              </section>

              <section className="col-span-1 rounded-lg border border-default-200 p-4">
                <h2 className="text-sm font-semibold text-foreground-600 mb-3">Permissions</h2>
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button size="sm" variant={!form.isadmin && !form.canrequest ? "solid" : "flat"} onPress={() => setForm((f) => ({ ...f, isadmin: false, canrequest: false }))}>Deactivated</Button>
                    <Button size="sm" variant={!form.isadmin && form.canrequest ? "solid" : "flat"} onPress={() => setForm((f) => ({ ...f, isadmin: false, canrequest: true }))}>Requester</Button>
                    <Button size="sm" variant={form.isadmin ? "solid" : "flat"} onPress={() => setForm((f) => ({ ...f, isadmin: true, canrequest: true }))}>Admin</Button>
                  </div>
                  <div className="flex gap-6">
                    <Checkbox isSelected={form.isadmin} onValueChange={(v) => setForm((f) => ({ ...f, isadmin: v }))}>Admin</Checkbox>
                    <Checkbox isSelected={form.canrequest} onValueChange={(v) => setForm((f) => ({ ...f, canrequest: v }))}>Can Request</Checkbox>
                  </div>
                </div>
              </section>
            </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <section className="col-span-1 rounded-lg border border-default-200 p-4">
            <h2 className="text-sm font-semibold text-foreground-600 mb-3">Security</h2>
            <div className="grid grid-cols-1 gap-3">
              <Input label="Password" name="password" type="password" value={form.password} onChange={onChange} isRequired />
            </div>
          </section>
        </div>

        {(error || usernameTaken || emailTaken) && (
          <p className="text-red-500 text-sm">
            {error || (usernameTaken && "Username already exists") || (emailTaken && "Email already exists")}
          </p>
        )}
        <div className="flex flex-col sm:flex-row justify-end gap-2">
          <Button type="button" variant="light" onPress={() => router.back()} className="w-full sm:w-auto">Cancel</Button>
          <Button color="primary" type="submit" isLoading={submitting} isDisabled={usernameTaken || emailTaken} className="w-full sm:w-auto">Create</Button>
        </div>
      </form>
    </div>
  );
}
