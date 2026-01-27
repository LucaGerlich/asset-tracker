"use client";

import { signOut } from "next-auth/react";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SignOutButton() {
  return (
    <DropdownMenuItem
      className="text-destructive cursor-pointer"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Log Out
    </DropdownMenuItem>
  );
}
