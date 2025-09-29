"use client";

import { useEffect, useLayoutEffect, useState } from "react";

const defaultSerialize = (value) => JSON.stringify(value);
const defaultDeserialize = (value) => JSON.parse(value);
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function usePersistentState(
  key,
  defaultValue,
  { serialize = defaultSerialize, deserialize = defaultDeserialize } = {}
) {
  const [state, setState] = useState(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  useIsomorphicLayoutEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null) {
        const parsed = deserialize(stored, defaultValue);
        setState(parsed);
      }
    } catch (e) {
      console.warn(`Failed to parse localStorage key "${key}"`, e);
    } finally {
      setIsHydrated(true);
    }
  }, [key, deserialize, defaultValue]);

  useEffect(() => {
    if (typeof window === "undefined" || !isHydrated) return;
    try {
      window.localStorage.setItem(key, serialize(state));
    } catch (e) {
      console.warn(`Failed to save localStorage key "${key}"`, e);
    }
  }, [key, state, serialize, isHydrated]);

  return [state, setState];
}
