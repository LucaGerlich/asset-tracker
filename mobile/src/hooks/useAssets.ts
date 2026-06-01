import { useState, useEffect, useReducer } from "react";
import * as api from "../api/client";
import {
  getCachedAssets,
  setCachedAssets,
  getCachedAssetById,
} from "../services/offline";
import { useNetworkStatus } from "./useNetworkStatus";
import type { Asset } from "../types";

/**
 * Hook providing assets with offline-first behavior.
 * Loads from cache first, then refreshes from the network.
 */
export function useAssets(params?: {
  search?: string;
  status?: string;
  page?: number;
}) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useNetworkStatus();
  const [refreshKey, forceRefresh] = useReducer((x: number) => x + 1, 0);

  const search = params?.search;
  const status = params?.status;
  const page = params?.page;

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const cached = await getCachedAssets();
      if (!cancelled && cached.length > 0) {
        setAssets(cached);
        setTotal(cached.length);
      }

      if (isConnected) {
        try {
          const result = await api.getAssets({
            search,
            status,
            page,
            limit: 50,
          });
          if (!cancelled) {
            setAssets(result.assets);
            setTotal(result.total);
          }
          await setCachedAssets(result.assets);
        } catch (err) {
          if (!cancelled && cached.length === 0) {
            setError(
              err instanceof Error ? err.message : "Failed to load assets",
            );
          }
        }
      } else if (!cancelled && cached.length === 0) {
        setError("No internet connection and no cached data available");
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isConnected, search, status, page, refreshKey]);

  return { assets, total, loading, error, refetch: forceRefresh };
}

/**
 * Hook for loading a single asset by ID with offline fallback.
 */
export function useAsset(id: string) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useNetworkStatus();
  const [refreshKey, forceRefresh] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const cached = await getCachedAssetById(id);
      if (!cancelled && cached) {
        setAsset(cached);
      }

      if (isConnected) {
        try {
          const result = await api.getAssetById(id);
          if (!cancelled) {
            setAsset(result);
          }
        } catch (err) {
          if (!cancelled && !cached) {
            setError(
              err instanceof Error ? err.message : "Failed to load asset",
            );
          }
        }
      } else if (!cancelled && !cached) {
        setError("No internet connection and asset not cached");
      }

      if (!cancelled) {
        setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, isConnected, refreshKey]);

  return { asset, loading, error, refetch: forceRefresh };
}
