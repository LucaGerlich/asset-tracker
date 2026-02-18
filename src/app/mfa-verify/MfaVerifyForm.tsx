"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
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

export default function MfaVerifyForm() {
  const router = useRouter();
  const { data: session } = useSession();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const username = session?.user?.username;
      if (!username) {
        setError("Session expired. Please log in again.");
        setIsLoading(false);
        return;
      }

      // Call signIn with MFA token — this triggers the mfaToken path in authorize()
      const result = await signIn("credentials", {
        username,
        password: "mfa-bypass",
        mfaToken: code.trim(),
        isBackupCode: useBackupCode ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        setError(
          useBackupCode
            ? "Invalid backup code. Please try again."
            : "Invalid verification code. Please try again."
        );
        setIsLoading(false);
      } else {
        // MFA verified — redirect to home
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      console.error("MFA verification error:", err);
      setError("An error occurred during verification");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            {useBackupCode
              ? "Enter one of your backup codes to continue"
              : "Enter the 6-digit code from your authenticator app"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">
                {useBackupCode ? "Backup Code" : "Verification Code"}
              </Label>
              <Input
                id="code"
                type="text"
                placeholder={useBackupCode ? "Enter backup code" : "000000"}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isLoading}
                autoComplete="one-time-code"
                inputMode={useBackupCode ? "text" : "numeric"}
                maxLength={useBackupCode ? 20 : 6}
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify"}
            </Button>

            <div className="text-center">
              <button
                type="button"
                className="text-sm text-muted-foreground hover:text-foreground underline"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode("");
                  setError("");
                }}
              >
                {useBackupCode
                  ? "Use authenticator app instead"
                  : "Use a backup code instead"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
