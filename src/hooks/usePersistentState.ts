"use client";

import { useEffect, useLayoutEffect, useState, type Dispatch, type SetStateAction } from "react";

type Serializer<T> = (value: T) => string;
type Deserializer<T> = (value: string, defaultValue: T) => T;

interface PersistentStateOptions<T> {
  serialize?: Serializer<T>;
  deserialize?: Deserializer<T>;
}

const defaultSerialize = <T>(value: T): string => JSON.stringify(value);
const defaultDeserialize = <T>(value: string): T => JSON.parse(value);
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function usePersistentState<T>(
  key: string,
  defaultValue: T,
  { serialize = defaultSerialize, deserialize = defaultDeserialize as Deserializer<T> }: PersistentStateOptions<T> = {}
): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState<T>(defaultValue);
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
