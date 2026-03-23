"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import MarketingNav from "@/components/marketing/MarketingNav";
import MarketingFooter from "@/components/marketing/MarketingFooter";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    period: "/mo",
    description: "Perfect for small teams getting started with asset tracking.",
    features: ["Up to 100 assets", "3 users", "Basic reports", "Email support"],
    cta: "Get Started Free",
    ctaHref: "/register",
    highlighted: false,
  },
  {
    name: "Professional",
    price: "$29",
    period: "/mo",
    description:
      "For growing teams that need advanced features and automation.",
    features: [
      "Up to 5,000 assets",
      "25 users",
      "Advanced reports",
      "Custom fields",
      "Workflow automation",
      "Priority support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    period: "/mo",
    description:
      "For large organizations with advanced security and integration needs.",
    features: [
      "Unlimited assets",
      "Unlimited users",
      "SSO / SAML",
      "API access",
      "Custom integrations",
      "Dedicated support",
    ],
    cta: "Contact Sales",
    ctaHref: "/register",
    highlighted: false,
  },
];

const faqs = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle. When upgrading, you'll receive a prorated credit for the remainder of your current cycle.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Absolutely. All paid plans come with a 14-day free trial, no credit card required. You'll have full access to all features during the trial period so you can evaluate everything before committing.",
  },
  {
    question: "What happens to my data if I cancel?",
    answer:
      "Your data remains accessible for 30 days after cancellation, giving you time to export everything you need. After that period, data is securely deleted from our servers in accordance with our data retention policy.",
  },
  {
    question: "Do you offer discounts for nonprofits or education?",
    answer:
      "Yes, we offer a 50% discount for verified nonprofit organizations and educational institutions. Contact our sales team with proof of status to apply for the discount.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit cards (Visa, Mastercard, American Express), as well as ACH bank transfers for annual plans. Enterprise customers can also pay via invoice with net-30 terms.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-border/60 border-b">
      <Button
        type="button"
        variant="ghost"
        className="flex h-auto w-full items-center justify-between rounded-none px-0 py-5 text-left hover:bg-transparent"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-foreground text-sm font-medium">{question}</span>
        <ChevronDown
          className={`text-muted-foreground h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </Button>
      {open && (
        <div className="pb-5">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PricingPageClient() {
  return (
    <div className="bg-background flex min-h-screen flex-col">
      <MarketingNav />

      <main className="flex-1">
        {/* Header */}
        <section className="pt-24 pb-16 sm:pt-32 sm:pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <h1 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                Simple, transparent pricing
              </h1>
              <p className="text-muted-foreground mt-4 text-lg">
                Start free and scale as your team grows. No hidden fees, no
                surprises.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="pb-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-3">
              {tiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={`relative flex flex-col ${
                    tier.highlighted
                      ? "border-primary ring-primary shadow-lg ring-1"
                      : ""
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-xs font-medium">
                        Recommended
                      </span>
                    </div>
                  )}

                  <CardHeader>
                    <CardTitle className="text-lg">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                    <div className="mt-4">
                      <span className="text-foreground text-4xl font-bold">
                        {tier.price}
                      </span>
                      <span className="text-muted-foreground text-sm">
                        {tier.period}
                      </span>
                    </div>
                  </CardHeader>

                  <CardContent className="flex-1">
                    <ul className="space-y-3">
                      {tier.features.map((feature) => (
                        <li
                          key={feature}
                          className="text-muted-foreground flex items-start gap-2 text-sm"
                        >
                          <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      variant={tier.highlighted ? "default" : "outline"}
                      asChild
                    >
                      <Link href={tier.ctaHref}>{tier.cta}</Link>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-border/40 border-t py-20 sm:py-28">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-foreground mb-10 text-center text-2xl font-bold tracking-tight sm:text-3xl">
              Frequently asked questions
            </h2>
            <div className="divide-y-0">
              {faqs.map((faq) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <MarketingFooter />
    </div>
  );
}
