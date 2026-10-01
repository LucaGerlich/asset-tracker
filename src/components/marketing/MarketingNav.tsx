"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import { MARKETING_LINKS } from "./content";

const LINKS = [
  { href: MARKETING_LINKS.features, label: "Features", external: false },
  { href: MARKETING_LINKS.pricing, label: "Pricing", external: false },
  { href: MARKETING_LINKS.github, label: "GitHub", external: true },
] as const;

const EXTERNAL = { target: "_blank", rel: "noopener noreferrer" } as const;

function LogoMark() {
  return (
    <span
      aria-hidden="true"
      className="border-mkt-text grid h-5 w-5 place-items-center border"
    >
      <span className="bg-mkt-accent h-2 w-2" />
    </span>
  );
}

// Fixed slot: ThemeSwitcher renders null until mounted, so reserve its space.
function ThemeSlot() {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center">
      <ThemeSwitcher />
    </span>
  );
}

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 border-b transition-colors ${
        scrolled
          ? "border-mkt-line bg-mkt-bg/90 backdrop-blur"
          : "border-transparent"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8"
      >
        <Link
          href="/"
          className="font-mkt-mono flex items-center gap-2.5 text-sm font-medium"
        >
          <LogoMark />
          Asset Tracker
        </Link>

        <div className="font-mkt-mono hidden items-center gap-7 text-[13px] md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="text-mkt-muted hover:text-mkt-text transition-colors"
              {...(l.external ? EXTERNAL : {})}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeSlot />
          <Link
            href={MARKETING_LINKS.login}
            className="text-mkt-muted hover:text-mkt-text text-sm"
          >
            Sign in
          </Link>
          <Link
            href={MARKETING_LINKS.register}
            className="bg-mkt-accent-fill text-mkt-accent-fill-fg rounded-md px-3.5 py-1.5 text-sm font-medium"
          >
            Start free
          </Link>
        </div>

        <button
          type="button"
          className="text-mkt-muted hover:text-mkt-text p-2 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="mkt-mobile-menu"
          aria-label="Toggle navigation menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div
          id="mkt-mobile-menu"
          className="border-mkt-line bg-mkt-bg border-t md:hidden"
        >
          <div className="font-mkt-mono mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="text-mkt-muted py-2"
                onClick={() => setOpen(false)}
                {...(l.external ? EXTERNAL : {})}
              >
                {l.label}
              </Link>
            ))}
            <div className="flex items-center gap-3 pt-2">
              <ThemeSlot />
              <Link href={MARKETING_LINKS.login} className="text-mkt-muted">
                Sign in
              </Link>
              <Link
                href={MARKETING_LINKS.register}
                className="bg-mkt-accent-fill text-mkt-accent-fill-fg ml-auto rounded-md px-3.5 py-1.5"
              >
                Start free
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
