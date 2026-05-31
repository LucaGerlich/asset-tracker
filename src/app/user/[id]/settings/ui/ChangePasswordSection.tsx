"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  KeyRound,
  Eye,
  EyeOff,
  Sparkles,
  Check,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";

const MIN_PASSWORD_LENGTH = 12;

// Character classes the generator pulls from. Excluded ambiguous chars (0/O, 1/l/I)
// so generated passwords are easier to type if the user copies them by hand.
const GEN_CHARSETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digit: "23456789",
  symbol: "!@#$%&*+-=?",
};

/**
 * Generate a cryptographically random password using crypto.getRandomValues.
 * Guarantees at least one character from each class so the result always satisfies
 * "uppercase + lowercase + digit + symbol" complexity expectations.
 */
function generateStrongPassword(length: number = 18): string {
  const allChars =
    GEN_CHARSETS.lower +
    GEN_CHARSETS.upper +
    GEN_CHARSETS.digit +
    GEN_CHARSETS.symbol;

  const required = [
    pickRandom(GEN_CHARSETS.lower),
    pickRandom(GEN_CHARSETS.upper),
    pickRandom(GEN_CHARSETS.digit),
    pickRandom(GEN_CHARSETS.symbol),
  ];

  const remaining = length - required.length;
  const random = Array.from({ length: remaining }, () => pickRandom(allChars));

  // Fisher-Yates shuffle so the required chars aren't predictably positioned at the start
  const combined = [...required, ...random];
  for (let i = combined.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

function pickRandom(charset: string): string {
  return charset[secureRandomInt(charset.length)];
}

function secureRandomInt(max: number): number {
  // Rejection sampling for unbiased range — naive `random % max` skews toward
  // small values when max doesn't divide evenly into the random space.
  const range = 256 - (256 % max);
  const buf = new Uint8Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < range) return buf[0] % max;
  }
}

type Strength = {
  level: 0 | 1 | 2 | 3 | 4;
  label: string;
  colorClass: string;
};

/**
 * Length-and-diversity-based strength heuristic. Per NIST SP 800-63B, length is
 * the dominant factor — a 24-char passphrase beats a 10-char `P@ss123!` even
 * though the latter would score higher in classic complexity meters.
 */
function evaluateStrength(password: string): Strength {
  if (password.length === 0)
    return { level: 0, label: "", colorClass: "bg-muted" };

  let score = 0;

  // Length scoring (dominant factor)
  if (password.length >= 12) score += 1;
  if (password.length >= 16) score += 1;
  if (password.length >= 20) score += 1;

  // Character class diversity (secondary)
  let classes = 0;
  if (/[a-z]/.test(password)) classes++;
  if (/[A-Z]/.test(password)) classes++;
  if (/\d/.test(password)) classes++;
  if (/[^a-zA-Z\d]/.test(password)) classes++;
  if (classes >= 3) score += 1;

  if (password.length < MIN_PASSWORD_LENGTH)
    return {
      level: 1,
      label: "Too short",
      colorClass: "bg-destructive",
    };
  if (score <= 1)
    return {
      level: 2,
      label: "Weak",
      colorClass: "bg-orange-500",
    };
  if (score === 2)
    return {
      level: 3,
      label: "Good",
      colorClass: "bg-yellow-500",
    };
  if (score === 3)
    return {
      level: 4,
      label: "Strong",
      colorClass: "bg-emerald-500",
    };
  return {
    level: 4,
    label: "Very strong",
    colorClass: "bg-emerald-600",
  };
}

export default function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [revokeOtherSessions, setRevokeOtherSessions] = useState(true);
  const [sendNotificationEmail, setSendNotificationEmail] = useState(false);

  const strength = evaluateStrength(newPassword);
  const tooShort =
    newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH;
  const mismatch =
    newPassword.length > 0 &&
    confirmPassword.length > 0 &&
    newPassword !== confirmPassword;
  const sameAsCurrent =
    newPassword.length > 0 &&
    currentPassword.length > 0 &&
    newPassword === currentPassword;

  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    confirmPassword === newPassword &&
    !sameAsCurrent &&
    !submitting;

  const reset = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setRevokeOtherSessions(true);
    setSendNotificationEmail(false);
  };

  const handleGenerate = () => {
    const generated = generateStrongPassword(18);
    setNewPassword(generated);
    setConfirmPassword(generated);
    setShowNew(true);
    setShowConfirm(true);
    toast.success("Generated a strong random password", {
      description: "Make sure to save it in your password manager.",
    });
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
          revokeOtherSessions,
          sendNotificationEmail,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to change password");
      }
      toast.success("Password changed", {
        description: revokeOtherSessions
          ? "Other devices have been signed out."
          : "Your new password is now active.",
      });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Could not change password", {
        description: (err as Error).message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="border-default-200 rounded-lg border p-4">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              <h2 className="text-foreground-600 text-sm font-semibold">
                Change Password
              </h2>
            </div>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>
        </CollapsibleTrigger>

        {!open && (
          <p className="text-muted-foreground mt-1 ml-6 text-xs">
            Update your password. Requires your current password.
          </p>
        )}

        <CollapsibleContent className="mt-4 space-y-4">
          {/* Current password */}
          <div className="space-y-1">
            <Label htmlFor="current-password">Current password</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className="pr-10"
                placeholder="Enter your current password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                aria-label={showCurrent ? "Hide password" : "Show password"}
                className="absolute top-0 right-0 h-full px-3"
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {/* New password with generator */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="new-password">New password</Label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
              >
                <Sparkles className="h-3 w-3" />
                Generate strong password
              </button>
            </div>
            <div className="relative">
              <Input
                id="new-password"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                className={`pr-10 ${tooShort || sameAsCurrent ? "border-destructive" : ""}`}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                aria-label={showNew ? "Hide password" : "Show password"}
                className="absolute top-0 right-0 h-full px-3"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Strength meter */}
            {newPassword.length > 0 && (
              <div className="space-y-1 pt-1">
                <div className="bg-muted flex h-1.5 gap-0.5 overflow-hidden rounded">
                  {[1, 2, 3, 4].map((segment) => (
                    <div
                      key={segment}
                      className={`flex-1 transition-colors ${
                        strength.level >= segment
                          ? strength.colorClass
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={
                      sameAsCurrent
                        ? "text-destructive"
                        : tooShort
                          ? "text-destructive"
                          : "text-muted-foreground"
                    }
                  >
                    {sameAsCurrent
                      ? "Cannot reuse your current password"
                      : tooShort
                        ? `${newPassword.length} / ${MIN_PASSWORD_LENGTH} characters`
                        : strength.label}
                  </span>
                  {!tooShort && !sameAsCurrent && (
                    <span className="text-muted-foreground">
                      {newPassword.length} characters
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="space-y-1">
            <Label htmlFor="confirm-password">Confirm new password</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                disabled={newPassword.length === 0}
                className={`pr-10 ${mismatch ? "border-destructive" : ""}`}
                placeholder="Re-enter the new password"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                tabIndex={-1}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute top-0 right-0 h-full px-3"
                disabled={newPassword.length === 0}
                onClick={() => setShowConfirm((v) => !v)}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </Button>
            </div>
            {mismatch ? (
              <p className="text-destructive text-xs">Passwords do not match</p>
            ) : confirmPassword.length > 0 &&
              newPassword === confirmPassword ? (
              <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                Passwords match
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Re-enter the new password to confirm
              </p>
            )}
          </div>

          {/* Options */}
          <div className="space-y-3 pt-1">
            <label
              htmlFor="revoke-sessions"
              className="flex items-start gap-2 text-sm"
            >
              <Checkbox
                id="revoke-sessions"
                checked={revokeOtherSessions}
                onCheckedChange={(v) => setRevokeOtherSessions(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">
                  Sign out of all other devices
                </span>
                <span className="text-muted-foreground block text-xs">
                  Keeps your current device signed in. Recommended if you
                  suspect someone else has access to your account.
                </span>
              </span>
            </label>

            <label
              htmlFor="send-notification-email"
              className="flex items-start gap-2 text-sm"
            >
              <Checkbox
                id="send-notification-email"
                checked={sendNotificationEmail}
                onCheckedChange={(v) => setSendNotificationEmail(Boolean(v))}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">
                  Email me when my password is changed
                </span>
                <span className="text-muted-foreground block text-xs">
                  Sends a confirmation to your account email so you can detect
                  unauthorized changes.
                </span>
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
              {submitting ? "Changing..." : "Change Password"}
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </section>
  );
}
