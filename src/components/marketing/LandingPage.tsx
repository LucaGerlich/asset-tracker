"use client";

import Link from "next/link";
import {
  Package,
  Key,
  Wrench,
  Shield,
  BarChart3,
  ShoppingCart,
  CheckCircle2,
  Cloud,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const features = [
  {
    icon: Package,
    title: "Asset Lifecycle",
    description:
      "Track every device from procurement to retirement with full audit history.",
  },
  {
    icon: Key,
    title: "License Compliance",
    description:
      "Monitor expirations, seat usage, and compliance in real time.",
  },
  {
    icon: Wrench,
    title: "Maintenance",
    description:
      "Automate schedules, track costs, and extend asset lifecycles.",
  },
  {
    icon: Shield,
    title: "Access Control",
    description: "Role-based permissions, SSO, and department scoping.",
  },
  {
    icon: ShoppingCart,
    title: "Procurement",
    description:
      "Request \u2192 Approve \u2192 Purchase Order \u2192 Receive. End-to-end.",
  },
  {
    icon: BarChart3,
    title: "Analytics",
    description: "TCO dashboards, depreciation forecasts, and custom reports.",
  },
];

const steps = [
  {
    number: "01",
    title: "Register your organization",
    description: "Create your workspace in seconds. Invite your team.",
  },
  {
    number: "02",
    title: "Import your inventory",
    description: "Bulk import from CSV or add assets manually. Scan QR codes.",
  },
  {
    number: "03",
    title: "Stay in control",
    description:
      "Dashboards, alerts, and reports keep you ahead of every deadline.",
  },
];

const checklist = [
  "Full asset lifecycle tracking",
  "License compliance with expiry alerts",
  "Automated maintenance scheduling",
  "Check-in / check-out with audit history",
  "Multi-organization with SSO and SCIM",
  "Procurement workflow with PO generation",
  "Self-hostable \u2014 your data, your infrastructure",
];

export default function LandingPage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      <MarketingNav />

      <main className="bg-background relative z-10 flex-1">
        {/* Hero */}
        <section className="pt-36 pb-24 sm:pt-44 sm:pb-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="border-border/60 text-muted-foreground mb-6 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                Coming Soon
              </p>
              <h1 className="text-foreground text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
                IT asset management,
                <br />
                <span className="text-muted-foreground">
                  without the complexity.
                </span>
              </h1>
              <p className="text-muted-foreground mx-auto mt-8 max-w-2xl text-lg leading-relaxed">
                Track hardware, software licenses, and consumables across your
                organization. Built for IT teams that need clarity, not chaos.
              </p>

              {/* Waitlist placeholder — hidden for now */}
              <div className="mt-10 hidden">
                <form className="mx-auto flex max-w-md gap-2">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="border-border bg-background flex-1 rounded-full border px-5 py-2.5 text-sm"
                  />
                  <Button type="submit" className="rounded-full px-6">
                    Notify Me
                  </Button>
                </form>
              </div>

              <p className="text-muted-foreground/60 mt-10 text-sm">
                Free to start. No credit card required.
              </p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="border-border/40 scroll-mt-20 border-t py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Built for modern IT teams
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Everything you need to track, manage, and optimize your
                organization&apos;s inventory.
              </p>
            </div>

            <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group border-border/50 bg-background hover:border-border rounded-2xl border p-6 transition-all hover:shadow-sm"
                >
                  <div className="border-border/50 bg-muted/50 mb-4 flex h-10 w-10 items-center justify-center rounded-xl border">
                    <feature.icon className="text-foreground h-5 w-5" />
                  </div>
                  <h3 className="text-foreground text-base font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="border-border/40 bg-muted/20 scroll-mt-20 border-t py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Up and running in minutes
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Three steps to full visibility over your assets.
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number} className="relative">
                  <span className="text-border/60 text-5xl font-bold">
                    {step.number}
                  </span>
                  <h3 className="text-foreground mt-4 text-lg font-semibold">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Trackly */}
        <section className="border-border/40 border-t py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-2">
              <div>
                <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                  Built for IT teams that value simplicity
                </h2>
                <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                  No bloated feature lists. No enterprise sales calls. Just the
                  tools you actually need to keep your assets organized and your
                  team accountable.
                </p>
              </div>

              <div className="space-y-4">
                {checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="text-foreground mt-0.5 h-5 w-5 shrink-0" />
                    <span className="text-muted-foreground text-sm">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Deploy on Your Terms */}
        <section className="border-border/40 bg-muted/20 border-t py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Deploy on your terms
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Self-host on your own infrastructure or use our managed cloud.
                Your data stays yours.
              </p>
            </div>

            <div className="mx-auto mt-16 grid max-w-4xl gap-6 md:grid-cols-2">
              <div className="border-border/50 bg-background rounded-2xl border p-8">
                <div className="border-border/50 bg-muted/50 mb-4 flex h-10 w-10 items-center justify-center rounded-xl border">
                  <Cloud className="text-foreground h-5 w-5" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">
                  Managed Cloud
                </h3>
                <ul className="text-muted-foreground mt-4 space-y-2.5 text-sm">
                  <li>Hosted and managed for you</li>
                  <li>Automatic updates and backups</li>
                  <li>Priority support included</li>
                  <li>14-day free trial</li>
                </ul>
              </div>

              <div className="border-border/50 bg-background rounded-2xl border p-8">
                <div className="border-border/50 bg-muted/50 mb-4 flex h-10 w-10 items-center justify-center rounded-xl border">
                  <Server className="text-foreground h-5 w-5" />
                </div>
                <h3 className="text-foreground text-lg font-semibold">
                  Self-Hosted
                </h3>
                <ul className="text-muted-foreground mt-4 space-y-2.5 text-sm">
                  <li>Full control over your data</li>
                  <li>No vendor lock-in</li>
                  <li>GDPR and compliance friendly</li>
                  <li>Free and open</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-border/40 border-t py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Be the first to know.
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Trackly is launching soon. We&apos;ll let you know when
                it&apos;s ready.
              </p>

              {/* Waitlist form — hidden for now */}
              <div className="mt-10 hidden">
                <form className="mx-auto flex max-w-md gap-2">
                  <input
                    type="email"
                    placeholder="you@company.com"
                    className="border-border bg-background flex-1 rounded-full border px-5 py-2.5 text-sm"
                  />
                  <Button type="submit" className="rounded-full px-6">
                    Notify Me
                  </Button>
                </form>
              </div>

              <div className="mt-10">
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8"
                  asChild
                >
                  <Link href="/login">Sign In</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
