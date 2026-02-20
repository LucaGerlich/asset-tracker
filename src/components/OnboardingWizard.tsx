"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  LayoutDashboard,
  Package,
  PanelLeft,
  QrCode,
  BarChart3,
} from "lucide-react";

const STEPS = [
  {
    icon: Sparkles,
    title: "Welcome to Asset Tracker",
    description:
      "Your all-in-one platform for managing hardware assets, software licences, accessories, and consumables. Let's take a quick tour of the key features to get you started.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard Overview",
    description:
      "Your dashboard gives you a snapshot of your entire inventory at a glance. View total asset counts, recent activity, upcoming licence expirations, maintenance schedules, and visual charts to understand your asset distribution.",
  },
  {
    icon: Package,
    title: "Asset Management",
    description:
      "Create and track assets with detailed information including serial numbers, purchase dates, warranties, and custom fields. You can also manage accessories, software licences, and consumables — all linked to your asset inventory.",
  },
  {
    icon: PanelLeft,
    title: "Navigation & Organization",
    description:
      "Use the sidebar to navigate between sections: Inventory for all your items, Categories to organize them, Tools for imports and QR scanning, and Administration for users, departments, and system settings.",
  },
  {
    icon: QrCode,
    title: "QR Codes & Scanning",
    description:
      "Generate QR code labels for any asset and scan them with your mobile device for instant lookup. Use the bulk QR generator to print label sheets, perfect for physical inventory management.",
  },
  {
    icon: BarChart3,
    title: "Reports & Administration",
    description:
      "Run detailed reports on asset value, depreciation, warranty status, and more. Export data to Excel, set up maintenance workflows, manage user roles and permissions, and configure system-wide settings from the admin panel.",
  },
];

export default function OnboardingWizard() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session?.user || loaded) return;

    const forceShow = searchParams.get("onboarding") === "1";

    if (forceShow) {
      setOpen(true);
      setStep(0);
      setLoaded(true);
      // Clean up the URL param
      const url = new URL(window.location.href);
      url.searchParams.delete("onboarding");
      router.replace(url.pathname + url.search, { scroll: false });
      return;
    }

    fetch("/api/user/preferences")
      .then((res) => res.json())
      .then((prefs) => {
        if (!prefs.onboardingCompleted) {
          setOpen(true);
        }
      })
      .catch(() => {
        // If prefs fetch fails, don't block the user
      })
      .finally(() => setLoaded(true));
  }, [session, loaded, searchParams, router]);

  const completeOnboarding = useCallback(async () => {
    setOpen(false);
    try {
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingCompleted: true }),
      });
    } catch {
      // Non-critical — wizard closes regardless
    }
  }, []);

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const currentStep = STEPS[step];
  const Icon = currentStep.icon;
  const [animating, setAnimating] = useState(false);
  const [direction, setDirection] = useState<"next" | "back">("next");

  const animatedNext = () => {
    setDirection("next");
    setAnimating(true);
    setTimeout(() => {
      handleNext();
      setAnimating(false);
    }, 150);
  };

  const animatedBack = () => {
    setDirection("back");
    setAnimating(true);
    setTimeout(() => {
      handleBack();
      setAnimating(false);
    }, 150);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) completeOnboarding();
      }}
    >
      <DialogContent
        className="max-w-lg"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Step indicator dots */}
        <div className="flex justify-center gap-1.5 pt-1">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "bg-primary w-4" : "bg-muted-foreground/25 w-1.5"
              }`}
            />
          ))}
        </div>

        <div
          className="transition-all duration-200 ease-in-out"
          style={{
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === "next" ? "-12px" : "12px"})`
              : "translateX(0)",
          }}
        >
          <DialogHeader className="items-center text-center">
            <div className="bg-primary/10 mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full">
              <Icon className="text-primary h-7 w-7" />
            </div>
            <DialogTitle className="text-xl">{currentStep.title}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {currentStep.description}
            </DialogDescription>
          </DialogHeader>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <Button variant="ghost" size="sm" onClick={completeOnboarding}>
            Skip
          </Button>

          <span className="text-muted-foreground text-xs">
            {step + 1} / {STEPS.length}
          </span>

          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={animatedBack}>
                Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={step === STEPS.length - 1 ? handleNext : animatedNext}
            >
              {step === STEPS.length - 1 ? "Get Started" : "Next"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
