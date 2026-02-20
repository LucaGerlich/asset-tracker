"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { useSession } from "next-auth/react";

export interface UserPreferences {
  theme: string;
  locale: string;
  timezone: string;
  currency: string;
  dateFormat: string;
  numberFormat: string;
  pageSize: number;
  onboardingCompleted: boolean;
  dashboardLayout: unknown | null;
  helpDismissed: unknown | null;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  locale: "en",
  timezone: "UTC",
  currency: "USD",
  dateFormat: "MM/DD/YYYY",
  numberFormat: "1,234.56",
  pageSize: 20,
  onboardingCompleted: false,
  dashboardLayout: null,
  helpDismissed: null,
};

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  updatePreferences: (partial: Partial<UserPreferences>) => Promise<void>;
}

const UserPreferencesContext = createContext<UserPreferencesContextValue>({
  preferences: DEFAULT_PREFERENCES,
  updatePreferences: async () => {},
});

export function UserPreferencesProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const [preferences, setPreferences] =
    useState<UserPreferences>(DEFAULT_PREFERENCES);

  useEffect(() => {
    if (status !== "authenticated" || !session?.user) return;

    let cancelled = false;

    async function fetchPreferences() {
      try {
        const res = await fetch("/api/user/preferences");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setPreferences((prev) => ({ ...prev, ...data }));
          }
        }
      } catch {
        // Silently fall back to defaults
      }
    }

    fetchPreferences();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user]);

  const updatePreferences = useCallback(
    async (partial: Partial<UserPreferences>) => {
      // Optimistically update local state
      setPreferences((prev) => ({ ...prev, ...partial }));

      try {
        const res = await fetch("/api/user/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(partial),
        });

        if (!res.ok) {
          throw new Error("Failed to update preferences");
        }

        const updated = await res.json();
        setPreferences((prev) => ({ ...prev, ...updated }));
      } catch (err) {
        // Revert on failure — re-fetch current state
        try {
          const res = await fetch("/api/user/preferences");
          if (res.ok) {
            const data = await res.json();
            setPreferences((prev) => ({ ...prev, ...data }));
          }
        } catch {
          // Keep optimistic state if refetch also fails
        }
        throw err;
      }
    },
    [],
  );

  return (
    <UserPreferencesContext.Provider value={{ preferences, updatePreferences }}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within a UserPreferencesProvider",
    );
  }
  return context;
}
