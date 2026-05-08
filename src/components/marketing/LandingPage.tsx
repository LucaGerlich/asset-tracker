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
  Terminal,
  ArrowRight,
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

const techStack = [
  "Next.js",
  "React",
  "PostgreSQL",
  "Prisma",
  "TypeScript",
  "Tailwind CSS",
];

export default function LandingPage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      <MarketingNav />

      <main className="bg-background relative z-10 flex-1">
        {/* ── Hero ── */}
        <section className="pt-36 pb-20 sm:pt-48 sm:pb-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-4xl text-center">
              <p className="border-border/60 text-muted-foreground mb-8 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                Coming Soon
              </p>
              <h1 className="text-foreground text-6xl font-extrabold tracking-tight sm:text-7xl lg:text-8xl">
                IT Asset
                <br />
                Management
              </h1>
              <p className="text-muted-foreground mx-auto mt-2 max-w-xl text-2xl font-medium tracking-tight sm:text-3xl">
                without the complexity.
              </p>
              <p className="text-muted-foreground/80 mx-auto mt-8 max-w-2xl text-base leading-relaxed">
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
            </div>

            {/* Terminal block */}
            <div className="mx-auto mt-16 max-w-2xl">
              <div className="border-border/40 dark:border-border/20 overflow-hidden rounded-xl border bg-[#0a0a0a] shadow-2xl">
                <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-4 py-3">
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <div className="h-2.5 w-2.5 rounded-full bg-white/10" />
                  <span className="ml-3 text-xs text-white/30">Terminal</span>
                </div>
                <div className="p-6 font-mono text-sm leading-relaxed">
                  <p className="text-white/40">
                    <span className="text-white/60">$</span> trackly init --org
                    &quot;Acme Corp&quot;
                  </p>
                  <p className="mt-1 text-emerald-400/80">
                    Organization created successfully.
                  </p>
                  <p className="mt-3 text-white/40">
                    <span className="text-white/60">$</span> trackly import
                    assets.csv
                  </p>
                  <p className="mt-1 text-emerald-400/80">
                    Imported 847 assets across 12 categories.
                  </p>
                  <p className="mt-3 text-white/40">
                    <span className="text-white/60">$</span> trackly status
                  </p>
                  <p className="mt-1 text-white/50">
                    847 assets &middot; 23 licences &middot; 4 expiring soon
                    &middot; 2 maintenance due
                  </p>
                </div>
              </div>
              <p className="text-muted-foreground/50 mt-4 text-center text-sm">
                Free to start. No credit card required.
              </p>
            </div>
          </div>
        </section>

        {/* ── Tech stack / credibility ── */}
        <section className="border-border/40 border-y py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-muted-foreground/50 mb-6 text-center text-xs font-medium tracking-widest uppercase">
              Built with
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
              {techStack.map((tech) => (
                <span
                  key={tech}
                  className="text-muted-foreground/40 hover:text-muted-foreground text-sm font-medium transition-colors"
                >
                  {tech}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="scroll-mt-20 py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                Built for modern
                <br />
                IT teams
              </h2>
              <p className="text-muted-foreground mt-5 text-base">
                Everything you need to track, manage, and optimize your
                organization&apos;s inventory.
              </p>
            </div>

            <div className="border-border/50 bg-border/50 mt-20 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="bg-background hover:bg-muted/30 p-8 transition-colors"
                >
                  <feature.icon className="text-foreground mb-4 h-5 w-5" />
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

        {/* ── How It Works ── */}
        <section
          id="how-it-works"
          className="border-border/40 scroll-mt-20 border-t py-28 sm:py-36"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                Up and running
                <br />
                in minutes
              </h2>
              <p className="text-muted-foreground mt-5 text-base">
                Three steps to full visibility over your assets.
              </p>
            </div>

            <div className="mt-20 grid gap-12 md:grid-cols-3">
              {steps.map((step) => (
                <div key={step.number}>
                  <span className="text-border/50 font-mono text-6xl font-bold">
                    {step.number}
                  </span>
                  <h3 className="text-foreground mt-5 text-lg font-semibold">
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

        {/* ── Why Trackly ── */}
        <section className="border-border/40 border-t py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-start gap-16 lg:grid-cols-2">
              <div>
                <h2 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                  Built for IT teams
                  <br />
                  that value simplicity
                </h2>
                <p className="text-muted-foreground mt-6 text-base leading-relaxed">
                  No bloated feature lists. No enterprise sales calls. Just the
                  tools you actually need to keep your assets organized and your
                  team accountable.
                </p>
              </div>

              <div className="space-y-4">
                {checklist.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <CheckCircle2 className="text-foreground/70 mt-0.5 h-5 w-5 shrink-0" />
                    <span className="text-muted-foreground text-sm">
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Deploy on Your Terms (dark panel) ── */}
        <section className="py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="border-border/40 dark:border-border/20 overflow-hidden rounded-3xl border bg-[#0a0a0a] px-8 py-20 text-white sm:px-16">
              <div className="mx-auto max-w-3xl text-center">
                <h2 className="text-4xl font-bold tracking-tight sm:text-5xl">
                  Deploy on your terms
                </h2>
                <p className="mt-5 text-base text-white/50">
                  Self-host on your own infrastructure or use our managed cloud.
                  Your data stays yours.
                </p>
              </div>

              <div className="mx-auto mt-16 grid max-w-3xl gap-6 md:grid-cols-2">
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
                  <Cloud className="mb-4 h-5 w-5 text-white/60" />
                  <h3 className="text-lg font-semibold text-white/90">
                    Managed Cloud
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-white/40">
                    <li>Hosted and managed for you</li>
                    <li>Automatic updates and backups</li>
                    <li>Priority support included</li>
                    <li>14-day free trial</li>
                  </ul>
                </div>

                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8">
                  <Server className="mb-4 h-5 w-5 text-white/60" />
                  <h3 className="text-lg font-semibold text-white/90">
                    Self-Hosted
                  </h3>
                  <ul className="mt-4 space-y-2.5 text-sm text-white/40">
                    <li>Full control over your data</li>
                    <li>No vendor lock-in</li>
                    <li>GDPR and compliance friendly</li>
                    <li>Free and open</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="border-border/40 border-t py-28 sm:py-36">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl">
                Be the first to know.
              </h2>
              <p className="text-muted-foreground mt-5 text-base">
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
                <Button variant="outline" className="rounded-full px-8" asChild>
                  <Link href="/login">
                    Sign In
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
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
