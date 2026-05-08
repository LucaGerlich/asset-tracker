"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X, Box } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MarketingNav() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 z-50 w-full transition-all duration-300 ${
        scrolled
          ? "border-border/60 bg-background/90 border-b shadow-sm backdrop-blur-xl"
          : "bg-transparent"
      }`}
    >
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 sm:px-6 lg:px-8 ${
          scrolled ? "h-14" : "h-20"
        }`}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <Box className="text-foreground h-6 w-6" />
          <span className="text-foreground text-lg font-semibold tracking-tight">
            Trackly
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link
            href="/#features"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Features
          </Link>
          <Link
            href="/#how-it-works"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            How it works
          </Link>
          <Link
            href="/pricing"
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            Pricing
          </Link>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/login">Sign In</Link>
          </Button>
        </div>

        <button
          type="button"
          className="text-muted-foreground hover:text-foreground inline-flex items-center justify-center rounded-md p-2 transition-colors md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </nav>

      {mobileMenuOpen && (
        <div className="border-border/40 bg-background border-t md:hidden">
          <div className="mx-auto max-w-7xl space-y-1 px-4 pt-2 pb-4 sm:px-6">
            <Link
              href="/#features"
              className="text-muted-foreground hover:bg-accent hover:text-foreground block rounded-md px-3 py-2 text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Features
            </Link>
            <Link
              href="/#how-it-works"
              className="text-muted-foreground hover:bg-accent hover:text-foreground block rounded-md px-3 py-2 text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              How it works
            </Link>
            <Link
              href="/pricing"
              className="text-muted-foreground hover:bg-accent hover:text-foreground block rounded-md px-3 py-2 text-sm transition-colors"
              onClick={() => setMobileMenuOpen(false)}
            >
              Pricing
            </Link>
            <div className="pt-3">
              <Button variant="outline" size="sm" className="w-full" asChild>
                <Link href="/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
