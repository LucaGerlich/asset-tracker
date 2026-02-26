"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Info, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface LoginPageProps {
  isDemo?: boolean;
}

interface SsoStatus {
  enabled: boolean;
  provider: string;
  providerName: string;
}

export default function LoginPage({ isDemo = false }: LoginPageProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [ssoStatus, setSsoStatus] = useState<SsoStatus | null>(null);

  useEffect(() => {
    fetch("/api/auth/sso-status")
      .then((res) => res.json())
      .then((data) => {
        if (data.enabled) setSsoStatus(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username: formData.username,
        password: formData.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password");
        setIsLoading(false);
      } else {
        // Redirect — the authorized callback will send MFA-pending users to /mfa-verify
        router.push("/dashboard");
        router.refresh();
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login");
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
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
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Asset Tracker</CardTitle>
          <CardDescription>
            Enter your credentials to access the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isDemo && (
            <div className="mb-4 rounded-md bg-amber-500/10 border border-amber-500/20 p-4">
              <div className="flex items-start gap-2">
                <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <p className="font-medium mb-2">Demo Mode</p>
                  <p className="mb-2">Data resets every 30 minutes. Use one of the demo accounts below:</p>
                  <div className="space-y-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => fillDemoCredentials(true)}
                    >
                      <span className="font-mono">demo_admin</span>
                      <span className="mx-2 text-muted-foreground">/</span>
                      <span className="font-mono">demo123</span>
                      <span className="ml-auto text-muted-foreground">(Admin)</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-xs"
                      onClick={() => fillDemoCredentials(false)}
                    >
                      <span className="font-mono">demo_user</span>
                      <span className="mx-2 text-muted-foreground">/</span>
                      <span className="font-mono">demo123</span>
                      <span className="ml-auto text-muted-foreground">(User)</span>
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
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Enter your password"
                value={formData.password}
                onChange={handleChange}
                disabled={isLoading}
                required
              />
            </div>
            <div className="flex justify-end">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot your password?
              </Link>
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          {ssoStatus && (
            <>
              <div className="relative my-4">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                  or
                </span>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  window.location.href = "/api/auth/sso-init";
                }}
              >
                <Shield className="h-4 w-4 mr-2" />
                Sign in with {ssoStatus.providerName}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

