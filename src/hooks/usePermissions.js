"use client";

import { useSession } from "next-auth/react";
import { userHasPermission } from "@/lib/permissions";

/**
 * Hook to check user permissions
 * @returns {Object} Permission checking functions
 */
export function usePermissions() {
  const { data: session } = useSession();

  const hasPermission = (permission) => {
    if (!session?.user) return false;
    return userHasPermission(session.user, permission);
  };

  const isAdmin = () => {
    return session?.user?.isAdmin || false;
  };

  const canRequest = () => {
    return session?.user?.canRequest || false;
  };

  return {
    hasPermission,
    isAdmin,
    canRequest,
    user: session?.user,
  };
}
