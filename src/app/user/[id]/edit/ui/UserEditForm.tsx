"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Eye, EyeOff, Check } from "lucide-react";

const MIN_PASSWORD_LENGTH = 12;

export default function UserEditForm({
  initial,
  isAdmin = false,
  initialRoles = [],
  initialUserRoles = [],
  initialDepartments = [],
}: {
  initial: any;
  isAdmin?: boolean;
  initialRoles?: Array<{ id: string; name: string }>;
  initialUserRoles?: Array<{ id: string; name: string }>;
  initialDepartments?: Array<{ id: string; name: string }>;
}) {
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
    departmentId: initial.departmentId ?? "",
    accessExpiresAt: initial.accessExpiresAt
      ? new Date(initial.accessExpiresAt).toISOString().slice(0, 16)
      : "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password validation state — derived once per render, no useState needed.
  const passwordEntered = form.password.length > 0;
  const passwordTooShort =
    passwordEntered && form.password.length < MIN_PASSWORD_LENGTH;
  const passwordsMismatch =
    passwordEntered &&
    confirmPassword.length > 0 &&
    form.password !== confirmPassword;
  const passwordValid =
    !passwordEntered ||
    (form.password.length >= MIN_PASSWORD_LENGTH &&
      form.password === confirmPassword);
  const [isDirty, setIsDirty] = useState(false);
  const [allRoles, setAllRoles] = useState(initialRoles);
  const [userRoles, setUserRoles] = useState(initialUserRoles);
  const departments = initialDepartments;

  const refreshRoles = useCallback(async () => {
    try {
      const [rolesRes, userRolesRes] = await Promise.all([
        fetch("/api/roles"),
        fetch(`/api/admin/users/${initial.userid}/roles`),
      ]);
      if (rolesRes.ok) setAllRoles(await rolesRes.json());
      if (userRolesRes.ok) setUserRoles(await userRolesRes.json());
    } catch {
      /* roles fetch failure is non-critical */
    }
  }, [initial.userid]);

  const assignRole = async (roleId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${initial.userid}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (res.ok) {
        toast.success("Role assigned");
        refreshRoles();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to assign role");
      }
    } catch (err) {
      console.error("Failed to assign role", err);
      toast.error("Failed to assign role");
    }
  };

  const removeRole = async (roleId: string) => {
    try {
      const res = await fetch(`/api/admin/users/${initial.userid}/roles`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (res.ok) {
        toast.success("Role removed");
        refreshRoles();
      }
    } catch (err) {
      console.error("Failed to remove role", err);
      toast.error("Failed to remove role");
    }
  };
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        firstname: initial.firstname ?? "",
        lastname: initial.lastname ?? "",
        username: initial.username ?? "",
        email: initial.email ?? "",
        lan: initial.lan ?? "",
        isadmin: Boolean(initial.isadmin),
        canrequest: Boolean(initial.canrequest),
        departmentId: initial.departmentId ?? "",
        accessExpiresAt: initial.accessExpiresAt
          ? new Date(initial.accessExpiresAt).toISOString().slice(0, 16)
          : "",
        password: "",
      }),
    [initial],
  );

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
        const res = await fetch(
          `/api/user/validate?username=${encodeURIComponent(form.username)}&excludeId=${encodeURIComponent(initial.userid)}`,
        );
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
        const res = await fetch(
          `/api/user/validate?email=${encodeURIComponent(form.email)}&excludeId=${encodeURIComponent(initial.userid)}`,
        );
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

    // Block submit if a password was entered but doesn't meet requirements.
    // Empty password is fine — means "don't change it".
    if (passwordEntered) {
      if (form.password.length < MIN_PASSWORD_LENGTH) {
        setError(
          `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        );
        return;
      }
      if (form.password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const body: Record<string, unknown> = { ...form };
      if (!body.password) delete body.password;
      if (!isAdmin) {
        delete body.isadmin;
        delete body.canrequest;
        delete body.departmentId;
        delete body.accessExpiresAt;
      } else {
        // Convert empty string to null for optional UUID field
        if (body.departmentId === "") body.departmentId = null;
        // Convert accessExpiresAt to ISO string or null
        if (body.accessExpiresAt) {
          body.accessExpiresAt = new Date(
            body.accessExpiresAt as string,
          ).toISOString();
        } else {
          body.accessExpiresAt = null;
        }
      }
      body._expectedVersion = initial.change_date ?? null;
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.status === 409) {
        const err = await res.json().catch(() => ({}));
        toast.error(
          err.error ||
            "This item was modified by someone else. Please refresh and try again.",
        );
        setSaving(false);
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to update user");
      }
      const updated = await res.json();
      toast.success("User updated", {
        description: updated.email || updated.username || "",
      });
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
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl md:text-3xl">
              Edit: {initial.firstname} {initial.lastname}
            </h1>
            <p className="text-foreground-500 mt-1 text-sm">
              {initial.email || "No email"}
              {initial.username ? ` • @${initial.username}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving || !passwordValid}
              className="w-full sm:w-auto"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
        <Separator />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Profile
            </h2>
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
                  onBlur={async () => {
                    if (
                      !form.username ||
                      form.username === (initial.username ?? "")
                    )
                      return;
                    try {
                      const res = await fetch(
                        `/api/user/validate?username=${encodeURIComponent(form.username)}&excludeId=${encodeURIComponent(initial.userid)}`,
                      );
                      const data = await res.json();
                      setUsernameTaken(Boolean(data?.username?.exists));
                    } catch {
                      /* validation fetch failure is non-blocking */
                    }
                  }}
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

          <section className="border-default-200 col-span-1 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Contact
            </h2>
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
                    if (!form.email || form.email === (initial.email ?? ""))
                      return;
                    try {
                      const res = await fetch(
                        `/api/user/validate?email=${encodeURIComponent(form.email)}&excludeId=${encodeURIComponent(initial.userid)}`,
                      );
                      const data = await res.json();
                      setEmailTaken(Boolean(data?.email?.exists));
                    } catch {
                      /* validation fetch failure is non-blocking */
                    }
                  }}
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

          {isAdmin && (
            <section className="border-default-200 col-span-1 rounded-lg border p-4">
              <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
                Permissions
              </h2>
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
                      setForm((f) => ({
                        ...f,
                        isadmin: false,
                        canrequest: true,
                      }))
                    }
                  >
                    Requester
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={form.isadmin ? "default" : "outline"}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        isadmin: true,
                        canrequest: true,
                      }))
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

                <Separator className="my-3" />

                <div>
                  <Label className="mb-2 block">Roles</Label>
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {userRoles.length === 0 ? (
                      <p className="text-muted-foreground text-xs">
                        No roles — default view permissions apply
                      </p>
                    ) : (
                      userRoles.map((role) => (
                        <Badge
                          key={role.id}
                          variant="secondary"
                          className="gap-1 pr-1"
                        >
                          {role.name}
                          <button
                            type="button"
                            onClick={() => removeRole(role.id)}
                            className="hover:bg-muted rounded-full p-0.5"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                  {allRoles.filter(
                    (r) => !userRoles.some((ur) => ur.id === r.id),
                  ).length > 0 && (
                    <Select onValueChange={assignRole}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Assign role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {allRoles
                          .filter(
                            (r) => !userRoles.some((ur) => ur.id === r.id),
                          )
                          .map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Separator className="my-3" />

                <div>
                  <Label htmlFor="departmentId" className="mb-2 block">
                    Department
                  </Label>
                  <Select
                    value={form.departmentId || "none"}
                    onValueChange={(v) =>
                      setForm((f) => ({
                        ...f,
                        departmentId: v === "none" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger id="departmentId" className="h-8 text-xs">
                      <SelectValue placeholder="Select department…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No department</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Separator className="my-3" />

                <div>
                  <Label htmlFor="accessExpiresAt" className="mb-2 block">
                    Access Expires
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="accessExpiresAt"
                      type="datetime-local"
                      className="h-8 text-xs"
                      value={form.accessExpiresAt}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          accessExpiresAt: e.target.value,
                        }))
                      }
                    />
                    {form.accessExpiresAt && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() =>
                          setForm((f) => ({ ...f, accessExpiresAt: "" }))
                        }
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    Leave empty for permanent access. User will be deactivated
                    automatically when this date passes.
                  </p>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          <section className="border-default-200 rounded-lg border p-4">
            <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
              Security
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="password">Set New Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={onChange}
                    placeholder="Leave blank to keep current"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    className={`pr-10 ${passwordTooShort ? "border-destructive" : ""}`}
                    aria-describedby="password-help"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-0 right-0 h-full px-3"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p
                  id="password-help"
                  className={`mt-1 text-xs ${
                    !passwordEntered
                      ? "text-muted-foreground"
                      : form.password.length >= MIN_PASSWORD_LENGTH
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                  }`}
                >
                  {!passwordEntered ? (
                    `Minimum ${MIN_PASSWORD_LENGTH} characters. Leave blank to keep current password.`
                  ) : form.password.length >= MIN_PASSWORD_LENGTH ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Meets {MIN_PASSWORD_LENGTH}-character minimum
                    </span>
                  ) : (
                    `${form.password.length} / ${MIN_PASSWORD_LENGTH} characters`
                  )}
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter the new password"
                    autoComplete="new-password"
                    minLength={MIN_PASSWORD_LENGTH}
                    disabled={!passwordEntered}
                    className={`pr-10 ${passwordsMismatch ? "border-destructive" : ""}`}
                    aria-describedby="confirm-help"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword ? "Hide password" : "Show password"
                    }
                    className="absolute top-0 right-0 h-full px-3"
                    disabled={!passwordEntered}
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p
                  id="confirm-help"
                  className={`mt-1 text-xs ${
                    passwordsMismatch
                      ? "text-destructive"
                      : passwordEntered &&
                          confirmPassword.length > 0 &&
                          form.password === confirmPassword
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                  }`}
                >
                  {passwordsMismatch ? (
                    "Passwords do not match"
                  ) : passwordEntered &&
                    confirmPassword.length > 0 &&
                    form.password === confirmPassword ? (
                    <span className="inline-flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Passwords match
                    </span>
                  ) : (
                    "Re-enter the password to confirm"
                  )}
                </p>
              </div>
            </div>
          </section>
        </div>

        {(error || usernameTaken || emailTaken) && (
          <p className="text-destructive text-sm" role="alert">
            {error ||
              (usernameTaken && "Username already exists") ||
              (emailTaken && "Email already exists")}
          </p>
        )}
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            onClick={handleCancel}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={saving || usernameTaken || emailTaken || !passwordValid}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </form>
    </div>
  );
}
