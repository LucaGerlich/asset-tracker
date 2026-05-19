import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Providers } from "../lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import SkipToContent from "../components/SkipToContent";
import Script from "next/script";
import OfflineBanner from "../components/OfflineBanner";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import AppShell from "../components/AppShell";
import { Toaster } from "sonner";
import { UserPreferencesProvider } from "../contexts/UserPreferencesContext";
import { cookies, headers } from "next/headers";
import { getBaseUrl } from "@/lib/url";
import { SITE_CONFIG } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: SITE_CONFIG.defaultTitle,
    template: SITE_CONFIG.titleTemplate,
  },
  description: SITE_CONFIG.description,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: SITE_CONFIG.siteName,
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  openGraph: {
    siteName: SITE_CONFIG.siteName,
    locale: SITE_CONFIG.locale,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }) {
  const [cookieStore, headersList] = await Promise.all([cookies(), headers()]);
  const sidebarPref = cookieStore.get("sidebar_collapsed");
  const initialSidebarCollapsed = sidebarPref?.value === "true";
  const isDemo = process.env.DEMO_MODE === "true";

  const nonce = headersList.get("x-nonce") ?? undefined;

  // Pass initial pathname so AppShell can render correctly on first frame
  const pathname = new URL(
    headersList.get("x-url") || headersList.get("x-invoke-path") || "/",
    "http://localhost",
  ).pathname;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <Script
          src="https://analytics.711x.de/script.js"
          data-website-id="733bdd9f-8777-407e-826b-3042eb417e4f"
          strategy="afterInteractive"
          nonce={nonce}
        />
        <SkipToContent />
        <OfflineBanner />
        <ServiceWorkerRegistration />
        <UserPreferencesProvider>
          <Providers>
            <AppShell
              initialSidebarCollapsed={initialSidebarCollapsed}
              isDemo={isDemo}
              initialPathname={pathname}
            >
              {children}
            </AppShell>
            <PWAInstallPrompt />
            <Toaster richColors />
          </Providers>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
