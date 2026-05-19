import Link from "next/link";
import {
  Package,
  Key,
  Wrench,
  Shield,
  BarChart3,
  Building2,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LANDING_FAQ } from "@/lib/seo";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const features = [
  {
    icon: Package,
    title: "Asset Tracking",
    description:
      "Track IT hardware, software, and equipment across your entire organization with real-time visibility and full audit history.",
  },
  {
    icon: Key,
    title: "License Management",
    description:
      "Monitor software licenses, track compliance, and get expiry alerts to avoid costly over- or under-licensing.",
  },
  {
    icon: Wrench,
    title: "Maintenance Scheduling",
    description:
      "Schedule and track preventive maintenance to extend asset lifecycles, reduce downtime, and lower total cost of ownership.",
  },
  {
    icon: Shield,
    title: "Role-Based Access",
    description:
      "Granular permissions and roles ensure the right people have access to the right data across your organization.",
  },
  {
    icon: BarChart3,
    title: "Reports & Analytics",
    description:
      "Gain insights with custom reports, dashboards, and CSV/PDF exports for informed decision-making and compliance audits.",
  },
  {
    icon: Building2,
    title: "Multi-Tenant",
    description:
      "Full organization isolation, SSO integration, and multi-tenant support built for enterprise IT teams.",
  },
];

const steps = [
  {
    number: "01",
    title: "Create your workspace",
    description:
      "Sign up and set up your organization in under two minutes. No credit card required.",
  },
  {
    number: "02",
    title: "Import or add assets",
    description:
      "Bulk-import from CSV or add assets manually. Tag them, assign owners, and set locations.",
  },
  {
    number: "03",
    title: "Track everything",
    description:
      "Monitor check-outs, license expirations, maintenance schedules, and consumable stock levels.",
  },
];

const stats = [
  { value: "10,000+", label: "Assets Tracked" },
  { value: "500+", label: "Organizations" },
  { value: "99.9%", label: "Uptime" },
];

export default function LandingPage() {
  return (
    <div className="bg-background relative flex min-h-screen flex-col">
      <MarketingNav />

      <main className="bg-background relative z-10 flex-1">
        {/* Hero Section */}
        <section aria-label="Hero" className="pt-32 pb-24 sm:pt-40 sm:pb-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <p className="border-border/60 text-muted-foreground mb-5 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                Open-Source Asset Tracking Platform
              </p>
              <h1 className="text-foreground text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                IT Asset Management
                <br />
                Software for Modern Teams
              </h1>
              <p className="text-muted-foreground mt-6 text-lg leading-relaxed">
                The complete platform to track hardware assets, manage software
                licenses, and monitor consumables across your organization.
                Built for IT teams that need clarity, not complexity.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" className="rounded-full px-8" asChild>
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-full px-8"
                  asChild
                >
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Stats / Trust */}
        <section
          aria-label="Statistics"
          className="border-border/40 border-y py-14"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-muted-foreground mb-10 text-center text-xs font-medium tracking-widest uppercase">
              Trusted by teams worldwide
            </p>
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section
          id="features"
          aria-label="Features"
          className="scroll-mt-20 py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="border-border/60 text-muted-foreground mb-3 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                Features
              </p>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need to manage IT assets
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                A complete toolkit for tracking, managing, and optimizing your
                organization&apos;s hardware and software inventory.
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

        {/* How it works */}
        <section
          id="how-it-works"
          aria-label="How it works"
          className="border-border/40 bg-muted/20 scroll-mt-20 border-t py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="border-border/60 text-muted-foreground mb-3 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                How it works
              </p>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Up and running in minutes
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Three simple steps to full visibility over your assets.
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

        {/* Checklist / Why us */}
        <section aria-label="Why Asset Tracker" className="py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-16 lg:grid-cols-2">
              <div>
                <p className="border-border/60 text-muted-foreground mb-3 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                  Why Asset Tracker
                </p>
                <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                  Built for IT teams that value simplicity
                </h2>
                <p className="text-muted-foreground mt-4 text-base">
                  No bloated feature lists. Just the tools you actually need to
                  keep your assets organized and your team accountable.
                </p>
              </div>

              <div className="space-y-5">
                {[
                  "Full asset lifecycle tracking from procurement to disposal",
                  "License compliance monitoring with expiry alerts",
                  "Automated maintenance reminders and scheduling",
                  "Check-in / check-out with full audit history",
                  "Multi-organization support with SSO",
                  "Custom fields, categories, and workflows",
                ].map((item) => (
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

        {/* FAQ Section */}
        <section
          id="faq"
          aria-label="Frequently asked questions"
          className="border-border/40 border-t py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="border-border/60 text-muted-foreground mb-3 inline-block rounded-full border px-4 py-1.5 text-xs font-medium tracking-wide">
                FAQ
              </p>
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently asked questions
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Everything you need to know about Asset Tracker and IT asset
                management.
              </p>
            </div>

            <div className="divide-border/50 mx-auto mt-16 max-w-3xl divide-y">
              {LANDING_FAQ.map((faq) => (
                <details key={faq.question} className="group py-5">
                  <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-4 text-left text-base font-medium [&::-webkit-details-marker]:hidden">
                    {faq.question}
                    <ChevronDown className="text-muted-foreground h-5 w-5 shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section
          aria-label="Call to action"
          className="border-border/40 bg-muted/20 border-t py-24 sm:py-32"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to take control of your IT assets?
              </h2>
              <p className="text-muted-foreground mt-4 text-base">
                Join hundreds of organizations already using Asset Tracker to
                streamline their asset management.
              </p>
              <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Button size="lg" className="rounded-full px-8" asChild>
                  <Link href="/register">
                    Get Started Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
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
