"use client";

export default function SkipToContent() {
  return (
    <a
      href="#main-content"
      className="fixed left-4 top-4 z-[9999] -translate-y-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-md transition-transform focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
    >
      Skip to main content
    </a>
  );
}
