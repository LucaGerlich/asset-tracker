"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import Navigation from "./Navigation";
import MobileNav from "./MobileNav";
import KeyboardShortcuts from "./KeyboardShortcuts";
import DemoBanner from "./DemoBanner";
import OnboardingWizard from "./OnboardingWizard";
import OfflineSyncIndicator from "./OfflineSyncIndicator";
import PageTransition from "./PageTransition";
import { isActivePath } from "@/lib/nav-config";

const PUBLIC_ROUTES = [
  "/login",
  "/register",
  "/setup",
  "/forgot-password",
  "/reset-password",
  "/mfa-verify",
  "/offline",
  "/suspended",
  "/pricing",
  "/terms",
  "/privacy",
];

interface AppShellProps {
  children: React.ReactNode;
  initialSidebarCollapsed: boolean;
  isDemo: boolean;
  initialPathname?: string;
}

export default function AppShell({
  children,
  initialSidebarCollapsed,
  isDemo,
  initialPathname,
}: AppShellProps) {
  const clientPathname = usePathname();
  const pathname = clientPathname || initialPathname || "/";

  const isPublicRoute =
    pathname === "/" ||
    PUBLIC_ROUTES.some((route) => isActivePath(pathname, route));

  if (isPublicRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <KeyboardShortcuts />
      <DemoBanner isDemo={isDemo} />
      <div className="bg-background flex h-screen overflow-hidden">
        <Sidebar initialCollapsed={initialSidebarCollapsed} />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Navigation />
          <OfflineSyncIndicator />
          <main
            id="main-content"
            className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8"
          >
            <PageTransition>{children}</PageTransition>
          </main>
          <MobileNav />
        </div>
      </div>
      <OnboardingWizard />
    </>
  );
}
