"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface UsePaginatedFetchReturn<T> {
  result: PaginatedResult<T> | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch with current params */
  refresh: () => void;
}

/**
 * Fetches paginated data from an API endpoint whenever `params` change.
 * Cancels in-flight requests when params change to avoid stale data.
 */
export function usePaginatedFetch<T>(
  apiUrl: string,
  params: Record<string, string>,
): UsePaginatedFetchReturn<T> {
  const [result, setResult] = useState<PaginatedResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const paramsKey = JSON.stringify(params);

  const fetchData = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value) qs.set(key, value);
      }

      const res = await fetch(`${apiUrl}?${qs.toString()}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.error(
          `[usePaginatedFetch] ${apiUrl} returned ${res.status}:`,
          body,
        );
        throw new Error(`API error: ${res.status}`);
      }

      const json = await res.json();
      if (!controller.signal.aborted) {
        const data = Array.isArray(json) ? json : json.data;
        const total = Array.isArray(json) ? json.length : json.total;
        const pg = Array.isArray(json) ? 1 : json.page;
        const ps = Array.isArray(json) ? json.length : json.pageSize;
        const tp = Array.isArray(json) ? 1 : json.totalPages;
        setResult({
          data: data ?? [],
          total: total ?? 0,
          page: pg,
          pageSize: ps,
          totalPages: tp,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      if (!controller.signal.aborted) {
        setError(err instanceof Error ? err.message : "Fetch failed");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiUrl, paramsKey]);

  useEffect(() => {
    fetchData();
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchData]);

  return { result, isLoading, error, refresh: fetchData };
}
