"use client";

import { useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  KeyRound,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
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

const ISSUER = "AssetTracker";

interface MfaSettingsProps {
  enabled: boolean;
  /** Local accounts confirm enrolment changes with their password; LDAP/SSO accounts have none. */
  requiresPassword: boolean;
}

type Step =
  "idle" | "password" | "qr" | "verify" | "backup" | "disable" | "regenerate";

type PasswordStep = Extract<Step, "password" | "disable" | "regenerate">;

const PASSWORD_PROMPTS: Record<
  PasswordStep,
  { title: string; description: string; action: string; destructive?: boolean }
> = {
  password: {
    title: "Confirm Your Password",
    description:
      "Enter your password to start setting up two-factor authentication.",
    action: "Continue",
  },
  disable: {
    title: "Disable Two-Factor Authentication",
    description:
      "This removes the extra security layer from your account. Confirm with your password.",
    action: "Disable MFA",
    destructive: true,
  },
  regenerate: {
    title: "New Backup Codes",
    description:
      "Your existing backup codes stop working once new ones are generated.",
    action: "Generate Codes",
  },
};

const errorMessage = (
  error: { message?: string } | null | undefined,
  fallback: string,
) => error?.message || fallback;

function secretFromTotpUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export default function MfaSettings({
  enabled: initialEnabled,
  requiresPassword,
}: MfaSettingsProps) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [step, setStep] = useState<Step>("idle");
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [totpUri, setTotpUri] = useState("");
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const reset = () => {
    setStep("idle");
    setPassword("");
    setTotpUri("");
    setCode("");
    setBackupCodes([]);
    setError("");
    setCopiedIndex(null);
  };

  // Omitted (not empty) so passwordless accounts are accepted by the server.
  const passwordBody = () => ({ password: password || undefined });

  const startEnrolment = async () => {
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.enable({
      ...passwordBody(),
      issuer: ISSUER,
    });
    setIsLoading(false);
    if (result.error || !result.data) {
      setError(errorMessage(result.error, "Failed to start MFA setup"));
      return;
    }
    setTotpUri(result.data.totpURI);
    setBackupCodes(result.data.backupCodes);
    setStep("qr");
  };

  const confirmEnrolment = async () => {
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setIsLoading(false);
    if (result.error) {
      setError(errorMessage(result.error, "Invalid verification code"));
      return;
    }
    setEnabled(true);
    setStep("backup");
    toast.success("Two-factor authentication is enabled");
  };

  const disableMfa = async () => {
    setIsLoading(true);
    setError("");
    const result = await authClient.twoFactor.disable(passwordBody());
    setIsLoading(false);
    if (result.error) {
      setError(errorMessage(result.error, "Failed to disable MFA"));
      return;
    }
    setEnabled(false);
    reset();
    toast.success("Two-factor authentication is disabled");
  };

  const regenerateBackupCodes = async () => {
    setIsLoading(true);
    setError("");
    const result =
      await authClient.twoFactor.generateBackupCodes(passwordBody());
    setIsLoading(false);
    if (result.error || !result.data) {
      setError(errorMessage(result.error, "Failed to generate backup codes"));
      return;
    }
    setBackupCodes(result.data.backupCodes);
    setStep("backup");
  };

  const submitPasswordStep = () => {
    if (step === "password") return startEnrolment();
    if (step === "disable") return disableMfa();
    if (step === "regenerate") return regenerateBackupCodes();
  };

  const openStep = (next: Step) => {
    if (!requiresPassword && next === "password") {
      void startEnrolment();
      return;
    }
    setStep(next);
  };

  const copyBackupCode = (value: string, index: number) => {
    void navigator.clipboard.writeText(value);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAllBackupCodes = () => {
    void navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("All backup codes copied to clipboard");
  };

  const passwordPrompt =
    step === "password" || step === "disable" || step === "regenerate"
      ? PASSWORD_PROMPTS[step]
      : null;
  const errorBox = error ? (
    <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
      {error}
    </div>
  ) : null;

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <h2 className="text-foreground-600 mb-3 flex items-center gap-2 text-sm font-semibold">
        <Shield className="h-4 w-4" />
        Two-Factor Authentication
      </h2>

      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm">
            {enabled ? (
              <span className="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400">
                <ShieldCheck className="h-4 w-4" />
                MFA is enabled
              </span>
            ) : (
              <span className="text-muted-foreground flex items-center gap-1.5">
                <ShieldOff className="h-4 w-4" />
                MFA is not enabled
              </span>
            )}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {enabled
              ? "Every sign-in asks for a code from your authenticator app."
              : "Add an extra layer of security to your account by enabling two-factor authentication."}
          </p>
        </div>

        {enabled ? (
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openStep("regenerate")}
            >
              <KeyRound className="mr-1.5 h-3.5 w-3.5" />
              New backup codes
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => openStep("disable")}
            >
              Disable MFA
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            onClick={() => openStep("password")}
            disabled={isLoading}
          >
            {isLoading ? "Setting up..." : "Enable MFA"}
          </Button>
        )}
      </div>

      <Dialog
        open={step !== "idle"}
        onOpenChange={(open) => {
          if (!open) reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {passwordPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>{passwordPrompt.title}</DialogTitle>
                <DialogDescription>
                  {requiresPassword
                    ? passwordPrompt.description
                    : passwordPrompt.description.replace(
                        /\s*Confirm with your password\.$/,
                        "",
                      )}
                </DialogDescription>
              </DialogHeader>
              <form
                className="space-y-4 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitPasswordStep();
                }}
              >
                {requiresPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="mfa-password">Password</Label>
                    <Input
                      id="mfa-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                    />
                  </div>
                )}
                {errorBox}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={reset}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant={
                      passwordPrompt.destructive ? "destructive" : "default"
                    }
                    disabled={isLoading || (requiresPassword && !password)}
                  >
                    {isLoading ? "Please wait..." : passwordPrompt.action}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

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
                <div className="rounded-lg border bg-white p-2">
                  <QRCodeCanvas value={totpUri} size={176} />
                </div>
                <div className="w-full">
                  <Label className="text-muted-foreground text-xs">
                    Manual entry key
                  </Label>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="bg-muted flex-1 rounded px-3 py-2 font-mono text-xs break-all">
                      {secretFromTotpUri(totpUri)}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      aria-label="Copy manual entry key"
                      onClick={() => {
                        void navigator.clipboard.writeText(
                          secretFromTotpUri(totpUri),
                        );
                        toast.success("Secret copied to clipboard");
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={reset}>
                  Cancel
                </Button>
                <Button onClick={() => setStep("verify")}>Continue</Button>
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
              <form
                className="space-y-4 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void confirmEnrolment();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="mfa-verify-code">Verification Code</Label>
                  <Input
                    id="mfa-verify-code"
                    type="text"
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    maxLength={6}
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                  />
                </div>
                {errorBox}
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setStep("qr")}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading || code.trim().length < 6}
                  >
                    {isLoading ? "Verifying..." : "Verify & Enable"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}

          {step === "backup" && (
            <>
              <DialogHeader>
                <DialogTitle>Save Your Backup Codes</DialogTitle>
                <DialogDescription>
                  Store these backup codes in a safe place. Each code can only
                  be used once. You will not be able to see these codes again.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-2">
                  {backupCodes.map((value, i) => (
                    <div
                      key={value}
                      className="flex items-center justify-between rounded border px-3 py-2"
                    >
                      <code className="font-mono text-sm">{value}</code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Copy backup code ${i + 1}`}
                        className="text-muted-foreground hover:text-foreground ml-2 h-6 w-6"
                        onClick={() => copyBackupCode(value, i)}
                      >
                        {copiedIndex === i ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={copyAllBackupCodes}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy All Codes
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={reset}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
