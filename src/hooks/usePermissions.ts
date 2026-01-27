"use client";

import { useSession } from "next-auth/react";
import { userHasPermission, type Permission } from "@/lib/permissions";

interface SessionUser {
  id?: string;
  isAdmin?: boolean;
  canRequest?: boolean;
  name?: string | null;
  email?: string | null;
  username?: string;
  firstname?: string;
  lastname?: string;
}

interface PermissionsHook {
  hasPermission: (permission: Permission) => boolean;
  isAdmin: () => boolean;
  canRequest: () => boolean;
  user: SessionUser | undefined;
}

/**
 * Hook to check user permissions
 */
export function usePermissions(): PermissionsHook {
  const { data: session } = useSession();
  const user = session?.user as SessionUser | undefined;

  const hasPermission = (permission: Permission): boolean => {
    if (!user) return false;
    return userHasPermission(user, permission);
  };

  const isAdmin = (): boolean => {
    return user?.isAdmin || false;
  };

  const canRequestFn = (): boolean => {
    return user?.canRequest || false;
  };

  return {
    hasPermission,
    isAdmin,
    canRequest: canRequestFn,
    user,
  };
}
