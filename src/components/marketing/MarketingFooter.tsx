import Link from "next/link";
import { Box } from "lucide-react";

export default function MarketingFooter() {
  return (
    <footer className="border-border/40 bg-muted/30 border-t">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5">
              <Box className="text-foreground h-5 w-5" />
              <span className="text-foreground text-base font-semibold tracking-tight">
                Trackly
              </span>
            </div>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              IT asset management platform for teams that value clarity over
              complexity.
            </p>
          </div>

          <div>
            <h3 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Product
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/#features"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Features
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/#how-it-works"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  How it works
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Legal
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/terms"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground text-xs font-semibold tracking-wider uppercase">
              Account
            </h3>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                >
                  Sign In
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-border/40 mt-12 border-t pt-8">
          <p className="text-muted-foreground text-center text-xs">
            &copy; {new Date().getFullYear()} Trackly. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
