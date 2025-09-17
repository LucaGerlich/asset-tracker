import "./globals.css";
import { Providers } from "./lib/providers";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Navigation from "./components/Navigation";
import Footer from "./components/Footer.jsx";

export const metadata = {
  title: "Dashboard",
  description: "Asset management tool",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}
    >
      <body>
        <Providers>
          <Navigation userName={"Luca Gerlich"} />
          <div className="flex h-fit flex-col md:flex-row overflow-hidden">
            <div className="flex-grow p-6 md:p-8 overflow-hidden">
              {children}
            </div>
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
