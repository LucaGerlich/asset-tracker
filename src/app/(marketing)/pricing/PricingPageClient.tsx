"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Eyebrow } from "@/components/marketing/primitives/Eyebrow";

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
    <div className="border-mkt-line border-b">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-4 py-5 text-left"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-medium">{question}</span>
        <ChevronDown
          aria-hidden="true"
          className={`text-mkt-muted h-4 w-4 shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <p className="text-mkt-muted pb-5 text-sm leading-relaxed">{answer}</p>
      )}
    </div>
  );
}

export default function PricingPageClient() {
  return (
    <>
      <section className="border-mkt-line relative overflow-hidden border-b">
        <div
          aria-hidden="true"
          className="mkt-grid pointer-events-none absolute inset-0"
        />
        <div className="relative mx-auto max-w-2xl px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <Eyebrow>PRICING</Eyebrow>
          <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="text-mkt-muted mt-4 text-lg">
            Start free and scale as your team grows. No hidden fees, no
            surprises.
          </p>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="border-mkt-line bg-mkt-line grid gap-px overflow-hidden rounded-xl border lg:grid-cols-3">
            {tiers.map((tier) => (
              <article
                key={tier.name}
                data-tier={tier.name}
                className={`bg-mkt-surface relative flex min-w-0 flex-col p-8 ${
                  tier.highlighted ? "ring-mkt-accent ring-1 ring-inset" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold">{tier.name}</h2>
                  {tier.highlighted && (
                    <span className="font-mkt-mono text-mkt-accent text-[11px] tracking-widest uppercase">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="text-mkt-muted mt-2 text-sm">
                  {tier.description}
                </p>
                <p className="font-mkt-mono mt-6">
                  <span className="text-4xl">{tier.price}</span>
                  <span className="text-mkt-muted text-sm">{tier.period}</span>
                </p>

                <ul className="mt-6 flex-1 space-y-3">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="text-mkt-muted flex items-start gap-2 text-sm"
                    >
                      <span
                        aria-hidden="true"
                        className="font-mkt-mono text-mkt-accent"
                      >
                        →
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href={tier.ctaHref}
                  className={`mt-8 block rounded-md px-4 py-2.5 text-center text-sm font-medium ${
                    tier.highlighted
                      ? "bg-mkt-accent-fill text-mkt-accent-fill-fg"
                      : "border-mkt-line hover:border-mkt-text border"
                  }`}
                >
                  {tier.cta}
                </Link>
                <p className="font-mkt-mono text-mkt-muted mt-4 text-[11px]">
                  limits · {tier.features[0].toLowerCase()} ·{" "}
                  {tier.features[1].toLowerCase()}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-mkt-line border-t py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 mb-10 text-2xl font-semibold tracking-tight sm:text-3xl">
            Frequently asked questions
          </h2>
          <div className="border-mkt-line border-t">
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
    </>
  );
}
