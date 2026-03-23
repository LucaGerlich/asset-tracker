import "./globals.css";
import { Providers } from "../lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import SkipToContent from "../components/SkipToContent";
import Script from "next/script";
import OfflineBanner from "../components/OfflineBanner";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import AppShell from "../components/AppShell";
import { UserPreferencesProvider } from "../contexts/UserPreferencesContext";
import { cookies } from "next/headers";

export const metadata = {
  title: "Asset Tracker",
  description:
    "Track and manage your organization's assets, licenses, and consumables",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Asset Tracker",
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
};

export const viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const sidebarPref = cookieStore.get("sidebar_collapsed");
  const initialSidebarCollapsed = sidebarPref?.value === "true";
  const isDemo = process.env.DEMO_MODE === "true";

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
        />
        <SkipToContent />
        <OfflineBanner />
        <ServiceWorkerRegistration />
        <UserPreferencesProvider>
          <Providers>
            <AppShell
              initialSidebarCollapsed={initialSidebarCollapsed}
              isDemo={isDemo}
            >
              {children}
            </AppShell>
            <PWAInstallPrompt />
          </Providers>
        </UserPreferencesProvider>
      </body>
    </html>
  );
}
