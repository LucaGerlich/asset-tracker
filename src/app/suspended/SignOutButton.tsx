"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { clearQueueOnSignOut } from "@/lib/offline-queue";

export default function SignOutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await clearQueueOnSignOut();
      await signOut();
      router.push("/login");
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={isSigningOut}
      onClick={handleSignOut}
    >
      Sign out
    </Button>
  );
}
