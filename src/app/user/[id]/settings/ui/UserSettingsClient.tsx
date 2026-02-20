"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast, Toaster } from "sonner";
import { useRouter } from "next/navigation";

interface UserSettingsClientProps {
  user: {
    userid: string;
    firstname: string;
    lastname: string;
    email: string | null;
  };
  preferences: {
    theme: string;
    locale: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    numberFormat: string;
    pageSize: number;
  };
}

const THEMES = [
  { value: "system", label: "System Default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "nl", label: "Dutch" },
];

const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (\u20ac)" },
  { value: "GBP", label: "GBP (\u00a3)" },
  { value: "CHF", label: "CHF" },
  { value: "JPY", label: "JPY (\u00a5)" },
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD" },
];

const NUMBER_FORMATS = [
  { value: "1,234.56", label: "1,234.56 (US/UK)" },
  { value: "1.234,56", label: "1.234,56 (EU)" },
];

const PAGE_SIZES = ["10", "20", "50", "100"];

export default function UserSettingsClient({
  user,
  preferences,
}: UserSettingsClientProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    theme: preferences.theme,
    locale: preferences.locale,
    timezone: preferences.timezone,
    currency: preferences.currency,
    dateFormat: preferences.dateFormat,
    numberFormat: preferences.numberFormat,
    pageSize: String(preferences.pageSize),
  });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          pageSize: Number(form.pageSize),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || "Failed to save settings");
      }
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Failed to save", { description: (err as Error).message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <Toaster position="bottom-right" />
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-foreground-500 mt-1 text-sm">
          Preferences for {user.firstname} {user.lastname}
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <section className="border-default-200 rounded-lg border p-4">
          <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
            Appearance
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="theme">Theme</Label>
              <Select
                value={form.theme}
                onValueChange={(v) => setForm((f) => ({ ...f, theme: v }))}
              >
                <SelectTrigger id="theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THEMES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="pageSize">Default Page Size</Label>
              <Select
                value={form.pageSize}
                onValueChange={(v) => setForm((f) => ({ ...f, pageSize: v }))}
              >
                <SelectTrigger id="pageSize">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s} rows
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <section className="border-default-200 rounded-lg border p-4">
          <h2 className="text-foreground-600 mb-3 text-sm font-semibold">
            Regional
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="locale">Language</Label>
              <Select
                value={form.locale}
                onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}
              >
                <SelectTrigger id="locale">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOCALES.map((l) => (
                    <SelectItem key={l.value} value={l.value}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input
                id="timezone"
                value={form.timezone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, timezone: e.target.value }))
                }
                placeholder="e.g. Europe/Berlin"
              />
            </div>
            <div>
              <Label htmlFor="dateFormat">Date Format</Label>
              <Select
                value={form.dateFormat}
                onValueChange={(v) => setForm((f) => ({ ...f, dateFormat: v }))}
              >
                <SelectTrigger id="dateFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_FORMATS.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="numberFormat">Number Format</Label>
              <Select
                value={form.numberFormat}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, numberFormat: v }))
                }
              >
                <SelectTrigger id="numberFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUMBER_FORMATS.map((n) => (
                    <SelectItem key={n.value} value={n.value}>
                      {n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        <Separator />

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </form>

      <section className="border-default-200 mt-6 rounded-lg border p-4">
        <h2 className="text-foreground-600 mb-1 text-sm font-semibold">
          Onboarding
        </h2>
        <p className="text-muted-foreground mb-3 text-sm">
          Re-watch the guided tour of the application&apos;s key features.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await fetch("/api/user/preferences", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onboardingCompleted: false }),
              });
              router.push("?onboarding=1");
            } catch {
              toast.error("Failed to restart onboarding");
            }
          }}
        >
          Restart Onboarding Tour
        </Button>
      </section>
    </div>
  );
}
