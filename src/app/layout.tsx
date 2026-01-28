import "./globals.css";
import { Providers } from "../lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";
import Sidebar from "../components/Sidebar";
import DemoBanner from "../components/DemoBanner";
import { SessionProvider } from "../components/SessionProvider";
import { auth } from "../auth";
import { cookies } from "next/headers";

export const metadata = {
  title: "Dashboard",
  description: "Asset management tool",
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
        <SessionProvider session={session}>
          <Providers>
            <DemoBanner isDemo={isDemo} />
            <div className="flex min-h-screen bg-background">
              <Sidebar initialCollapsed={initialSidebarCollapsed} />
              <div className="flex flex-1 flex-col">
                <Navigation />
                <main className="flex-1 overflow-y-auto p-6 md:p-8">
                  {children}
                </main>
                <Footer />
              </div>
            </div>
          </Providers>
        </SessionProvider>
      </body>
    </html>
  );
}
