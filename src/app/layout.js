import "./globals.css";
import { Providers } from "../lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer.jsx";
import Sidebar from "../components/Sidebar";
import { cookies } from "next/headers";

export const metadata = {
  title: "Dashboard",
  description: "Asset management tool",
};

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const sidebarPref = cookieStore.get("sidebar_collapsed");
  const initialSidebarCollapsed = sidebarPref?.value === "true";

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <Providers>
          <div className="flex min-h-screen bg-background">
            <Sidebar initialCollapsed={initialSidebarCollapsed} />
            <div className="flex flex-1 flex-col">
              <Navigation userName={"Luca Gerlich"} />
              <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 lg:p-10 xl:p-12">
                {children}
              </main>
              <Footer />
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
