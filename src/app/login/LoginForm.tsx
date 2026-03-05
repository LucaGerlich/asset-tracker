"use client";

import { useState, useEffect } from "react";
import { signIn } from "@/lib/auth-client";
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
      // Support both username and email login
      const isEmail = formData.username.includes("@");
      const result = isEmail
        ? await signIn.email({
            email: formData.username,
            password: formData.password,
          })
        : await (signIn as any).username({
            username: formData.username,
            password: formData.password,
          });

      if (result?.error) {
        setError(result.error.message || "Invalid username or password");
        setIsLoading(false);
      } else if ((result?.data as any)?.twoFactorRedirect) {
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>
          {ssoStatus && (
            <>
              <div className="relative my-4">
                <Separator />
                <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-2 text-xs">
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
                <Shield className="mr-2 h-4 w-4" />
                Sign in with {ssoStatus.providerName}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
