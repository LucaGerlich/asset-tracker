"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, ShieldCheck, ShieldOff, Copy, Check } from "lucide-react";

interface MfaSettingsProps {
  userId: string;
  mfaEnabled: boolean;
}

type SetupStep = "idle" | "qr" | "verify" | "backup" | "disable";

export default function MfaSettings({ userId, mfaEnabled: initialMfaEnabled }: MfaSettingsProps) {
  const [mfaEnabled, setMfaEnabled] = useState(initialMfaEnabled);
  const [step, setStep] = useState<SetupStep>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyToken, setVerifyToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const resetState = () => {
    setStep("idle");
    setQrCode("");
    setSecret("");
    setVerifyToken("");
    setBackupCodes([]);
    setDisablePassword("");
    setError("");
    setCopiedIndex(null);
    setDialogOpen(false);
  };

  const handleStartSetup = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to start MFA setup");
      }
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setStep("qr");
      setDialogOpen(true);
    } catch (err) {
      toast.error("Failed to start MFA setup", {
        description: (err as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyToken = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: verifyToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to verify token");
      }
      setBackupCodes(data.backupCodes);
      setMfaEnabled(true);
      setStep("backup");
      toast.success("MFA has been enabled successfully");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: disablePassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to disable MFA");
      }
      setMfaEnabled(false);
      resetState();
      toast.success("MFA has been disabled");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const copyBackupCode = (code: string, index: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("All backup codes copied to clipboard");
  };

  return (
    <section className="rounded-lg border border-default-200 p-4">
      <h2 className="text-sm font-semibold text-foreground-600 mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4" />
        Two-Factor Authentication
      </h2>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">
            {mfaEnabled ? (
              <span className="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-medium">
                <ShieldCheck className="h-4 w-4" />
                MFA is enabled
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <ShieldOff className="h-4 w-4" />
                MFA is not enabled
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {mfaEnabled
              ? "Your account is protected with two-factor authentication."
              : "Add an extra layer of security to your account by enabling two-factor authentication."}
          </p>
        </div>

        {mfaEnabled ? (
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              setStep("disable");
              setDialogOpen(true);
            }}
          >
            Disable MFA
          </Button>
        ) : (
          <Button size="sm" onClick={handleStartSetup} disabled={isLoading}>
            {isLoading ? "Setting up..." : "Enable MFA"}
          </Button>
        )}
      </div>

      {/* MFA Setup Dialog */}
      <Dialog
        open={dialogOpen && (step === "qr" || step === "verify" || step === "backup")}
        onOpenChange={(open) => {
          if (!open && step !== "backup") {
            resetState();
          }
          if (!open && step === "backup") {
            resetState();
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {step === "qr" && (
            <>
              <DialogHeader>
                <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
                <DialogDescription>
                  Scan this QR code with your authenticator app (Google
                  Authenticator, Authy, 1Password, etc.)
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {qrCode && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={qrCode}
                    alt="MFA QR Code"
                    className="w-48 h-48 rounded-lg border"
                  />
                )}
                <div className="w-full">
                  <Label className="text-xs text-muted-foreground">
                    Manual entry key
                  </Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 rounded bg-muted px-3 py-2 text-xs font-mono break-all">
                      {secret}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(secret);
                        toast.success("Secret copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetState}>
                  Cancel
                </Button>
                <Button onClick={() => setStep("verify")}>
                  Continue
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "verify" && (
            <>
              <DialogHeader>
                <DialogTitle>Verify Your Authenticator</DialogTitle>
                <DialogDescription>
                  Enter the 6-digit code shown in your authenticator app to
                  complete setup.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-token">Verification Code</Label>
                  <Input
                    id="mfa-verify-token"
                    type="text"
                    placeholder="000000"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {error && (
                  <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setStep("qr")}>
                  Back
                </Button>
                <Button
                  onClick={handleVerifyToken}
                  disabled={isLoading || verifyToken.length < 6}
                >
                  {isLoading ? "Verifying..." : "Verify & Enable"}
                </Button>
              </DialogFooter>
            </>
          )}

          {step === "backup" && (
            <>
              <DialogHeader>
                <DialogTitle>Save Your Backup Codes</DialogTitle>
                <DialogDescription>
                  Store these backup codes in a safe place. Each code can only be
                  used once. You will not be able to see these codes again.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((code, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded border px-3 py-2"
                    >
                      <code className="text-sm font-mono">{code}</code>
                      <button
                        type="button"
                        onClick={() => copyBackupCode(code, i)}
                        className="text-muted-foreground hover:text-foreground ml-2"
                      >
                        {copiedIndex === i ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={copyAllBackupCodes}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All Codes
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={resetState}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Disable MFA Dialog */}
      <Dialog
        open={dialogOpen && step === "disable"}
        onOpenChange={(open) => {
          if (!open) resetState();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Enter your password to confirm disabling MFA. This will remove the
              extra security layer from your account.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="disable-password">Password</Label>
              <Input
                id="disable-password"
                type="password"
                placeholder="Enter your password"
                value={disablePassword}
                onChange={(e) => setDisablePassword(e.target.value)}
                autoFocus
              />
            </div>
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetState}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisableMfa}
              disabled={isLoading || !disablePassword}
            >
              {isLoading ? "Disabling..." : "Disable MFA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
