"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Syncs a record of string key-value pairs with URL search parameters.
 *
 * - Reads initial values from the current URL, falling back to `defaults`.
 * - The setter merges partial updates into the current state and pushes them
 *   to the URL via `router.replace` (shallow navigation).
 * - Parameters whose value matches the default are omitted from the URL to
 *   keep it clean.
 * - URL writes are debounced by 100 ms to avoid rapid rewrites while the
 *   user is typing.
 */
export function useUrlState<T extends Record<string, string>>(
  defaults: T
): [T, (updates: Partial<T>) => void] {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Build the initial state: URL params take precedence over defaults.
  const buildStateFromParams = useCallback(() => {
    const state = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const urlValue = searchParams.get(key);
      if (urlValue !== null) {
        (state as Record<string, string>)[key] = urlValue;
      }
    }
    return state;
  }, [defaults, searchParams]);

  const [state, setState] = useState<T>(buildStateFromParams);

  // Keep state in sync when searchParams change externally (e.g. back/forward).
  const prevParamsRef = useRef(searchParams.toString());
  useEffect(() => {
    const currentParams = searchParams.toString();
    if (currentParams !== prevParamsRef.current) {
      prevParamsRef.current = currentParams;
      setState(buildStateFromParams());
    }
  }, [searchParams, buildStateFromParams]);

  // Debounce timer ref for URL updates.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Keep a ref to the latest state so the debounced callback always sees it.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Refs for stable values inside the debounced flush.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const defaultsRef = useRef(defaults);
  defaultsRef.current = defaults;
  const routerRef = useRef(router);
  routerRef.current = router;

  const flushToUrl = useCallback(() => {
    const params = new URLSearchParams();
    const current = stateRef.current;
    const defs = defaultsRef.current;

    for (const key of Object.keys(defs)) {
      const value = current[key];
      // Only include non-default values in the URL.
      if (value !== undefined && value !== defs[key]) {
        params.set(key, value);
      }
    }

    const qs = params.toString();
    const url = qs ? `${pathnameRef.current}?${qs}` : pathnameRef.current;

    prevParamsRef.current = params.toString();
    routerRef.current.replace(url, { scroll: false });
  }, []);

  const setUrlState = useCallback(
    (updates: Partial<T>) => {
      setState((prev) => {
        const next = { ...prev, ...updates } as T;
        return next;
      });

      // Debounce the actual URL write by 100 ms.
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        flushToUrl();
      }, 100);
    },
    [flushToUrl]
  );

  // Clean up pending timer on unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return [state, setUrlState];
}
