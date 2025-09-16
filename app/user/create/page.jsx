"use client";
import React, { useState } from "react";
import { Button, Input, Checkbox, Card, CardHeader, CardBody } from "@nextui-org/react";
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
    isadmin: false,
    canrequest: true,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

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
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <Card>
        <CardHeader>Create User</CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="First Name" name="firstname" value={form.firstname} onChange={onChange} isRequired />
              <Input label="Last Name" name="lastname" value={form.lastname} onChange={onChange} isRequired />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label="Username" name="username" value={form.username} onChange={onChange} />
              <Input label="Email" name="email" type="email" value={form.email} onChange={onChange} />
            </div>
            <Input label="Password" name="password" type="password" value={form.password} onChange={onChange} isRequired />
            <div className="flex gap-6">
              <Checkbox isSelected={form.isadmin} onValueChange={(v) => setForm((f) => ({ ...f, isadmin: v }))}>Admin</Checkbox>
              <Checkbox isSelected={form.canrequest} onValueChange={(v) => setForm((f) => ({ ...f, canrequest: v }))}>Can Request</Checkbox>
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="light" onPress={() => router.back()}>Cancel</Button>
              <Button color="primary" type="submit" isLoading={submitting}>Create</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
