"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { signIn, authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Info, Shield, Eye, EyeOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface TurnstileWidget {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

/**
 * Lightweight Turnstile hook — loads the script once and renders the widget
 * in managed (invisible) mode. Returns the current token and a reset function.
 */
function useTurnstile(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [token, setToken] = useState<string | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    setToken(null);
    if (
      widgetIdRef.current !== null &&
      typeof window !== "undefined" &&
      window.turnstile
    ) {
      window.turnstile.reset(widgetIdRef.current);
    }
  }, []);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    function renderWidget() {
      if (!containerRef.current) return;
      // Avoid double-render
      if (widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        size: "flexible",
        callback: (tok: string) => setToken(tok),
        "expired-callback": () => setToken(null),
        "error-callback": () => setToken(null),
      });
    }

    // If script already loaded, render immediately
    if (window.turnstile) {
      renderWidget();
      return;
    }

    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.onload = () => renderWidget();
    document.head.appendChild(script);

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [containerRef]);

  return { token, reset };
}

interface LoginPageProps {
  isDemo?: boolean;
  microsoftEnabled?: boolean;
  googleEnabled?: boolean;
}

interface SsoStatus {
  enabled: boolean;
  provider: string;
  providerName: string;
}

export default function LoginPage({
  isDemo = false,
  microsoftEnabled = false,
  googleEnabled = false,
}: LoginPageProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus | null>(null);
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const { token: turnstileToken, reset: resetTurnstile } =
    useTurnstile(turnstileRef);

  // Redirect to initial setup when no users exist yet
  useEffect(() => {
    fetch("/api/setup/status")
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) router.replace("/setup");
      })
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/sso-status")
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled) setSsoStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn.email({
        email: formData.username, // accepts username or email; hook resolves username→email
        password: formData.password,
        fetchOptions: TURNSTILE_SITE_KEY
          ? {
              headers: {
                "x-turnstile-token": turnstileToken || "",
              },
            }
          : undefined,
      });

      if (result?.error) {
        setError(result.error.message || "Invalid username or password");
        resetTurnstile();
        setIsLoading(false);
      } else if (
        (result?.data as { twoFactorRedirect?: boolean })?.twoFactorRedirect
      ) {
        // User has 2FA enabled — redirect to MFA verification
        router.push("/mfa-verify");
      } else {
        // Login succeeded without MFA
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login");
      resetTurnstile();
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const fillDemoCredentials = (isAdmin: boolean) => {
    setFormData({
      username: isAdmin ? "demo_admin" : "demo_user",
      password: "demo123",
    });
  };

  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Asset Tracker</CardTitle>
          <CardDescription>
            Enter your credentials to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDemo && (
            <div className="mb-4 rounded-md border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-start gap-2">
                <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="mb-2 font-medium">Demo Mode</p>
                  <p className="mb-2">
                    Data resets every 30 minutes. Use one of the demo accounts
                    below:
                  </p>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => fillDemoCredentials(true)}
                    >
                      <span className="font-mono">demo_admin</span>
                      <span className="text-muted-foreground mx-2">/</span>
                      <span className="font-mono">demo123</span>
                      <span className="text-muted-foreground ml-auto">
                        (Admin)
                      </span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => fillDemoCredentials(false)}
                    >
                      <span className="font-mono">demo_user</span>
                      <span className="text-muted-foreground mx-2">/</span>
                      <span className="font-mono">demo123</span>
                      <span className="text-muted-foreground ml-auto">
                        (User)
                      </span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                value={formData.username}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={isLoading}
                  required
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-0 right-0 h-full px-3"
                  disabled={isLoading}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <div className="flex justify-end">
              <Link
                href="/forgot-password"
                className="text-primary text-sm hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
            {error && (
              <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
                {error}
              </div>
            )}
            {TURNSTILE_SITE_KEY && (
              <div ref={turnstileRef} className="flex justify-center" />
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          {(ssoStatus || microsoftEnabled || googleEnabled) && (
            <>
              <div className="relative my-4">
                <Separator />
                <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
                  or
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {microsoftEnabled && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await authClient.signIn.oauth2({
                        providerId: "microsoft",
                        callbackURL: "/dashboard",
                      });
                    }}
                  >
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 21 21"
                      fill="none"
                    >
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    Sign in with Microsoft
                  </Button>
                )}
                {googleEnabled && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={async () => {
                      await authClient.signIn.oauth2({
                        providerId: "google",
                        callbackURL: "/dashboard",
                      });
                    }}
                  >
                    <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </Button>
                )}
                {ssoStatus && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      window.location.href = "/api/auth/sso-init";
                    }}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    Sign in with {ssoStatus.providerName}
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
