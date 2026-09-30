// app/providers.tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";

interface ProvidersProps {
  children: React.ReactNode;
  /** CSP nonce so next-themes' pre-hydration script isn't blocked. */
  nonce?: string;
}

export function Providers({ children, nonce }: ProvidersProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={true}
      nonce={nonce}
    >
      <TooltipProvider>{children}</TooltipProvider>
    </NextThemesProvider>
  );
}
