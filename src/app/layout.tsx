import "./globals.css";
import { Providers } from "../lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";
import DemoBanner from "../components/DemoBanner";
import SkipToContent from "../components/SkipToContent";
import KeyboardShortcuts from "../components/KeyboardShortcuts";
import MobileNav from "../components/MobileNav";
import OfflineBanner from "../components/OfflineBanner";
import { SessionProvider } from "../components/SessionProvider";
import PWAInstallPrompt from "../components/PWAInstallPrompt";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";
import { auth } from "../auth";
import { cookies } from "next/headers";

export const metadata = {
  title: "Dashboard",
  description: "Asset management tool",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Asset Tracker",
  },
};

export const viewport = {
  themeColor: "#0f172a",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const sidebarPref = cookieStore.get("sidebar_collapsed");
  const initialSidebarCollapsed = sidebarPref?.value === "true";
  const session = await auth();
  const isDemo = process.env.DEMO_MODE === "true";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <SkipToContent />
        <OfflineBanner />
        <ServiceWorkerRegistration />
        <SessionProvider session={session}>
          <Providers>
            <KeyboardShortcuts />
            <DemoBanner isDemo={isDemo} />
            <div className="flex min-h-screen bg-background">
              <Sidebar initialCollapsed={initialSidebarCollapsed} />
              <div className="flex flex-1 flex-col">
                <Navigation />
                <main id="main-content" className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">
                  {children}
                </main>
                <Footer />
                <MobileNav />
              </div>
            </div>
            <PWAInstallPrompt />
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
