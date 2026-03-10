import { useState, useEffect, useCallback } from 'react';
import * as api from '../api/client';
import {
  getCachedAssets,
  setCachedAssets,
  getCachedAssetById,
} from '../services/offline';
import { useNetworkStatus } from './useNetworkStatus';
import type { Asset } from '../types';

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

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Load from cache first
    const cached = await getCachedAssets();
    if (cached.length > 0) {
      setAssets(cached);
      setTotal(cached.length);
    }

    // If online, fetch fresh data
    if (isConnected) {
      try {
        const result = await api.getAssets({
          search: params?.search,
          status: params?.status,
          page: params?.page,
          limit: 50,
        });
        setAssets(result.assets);
        setTotal(result.total);
        await setCachedAssets(result.assets);
      } catch (err) {
        if (cached.length === 0) {
          setError(
            err instanceof Error ? err.message : 'Failed to load assets',
          );
        }
      }
    } else if (cached.length === 0) {
      setError('No internet connection and no cached data available');
    }

    setLoading(false);
  }, [isConnected, params?.search, params?.status, params?.page]);

  useEffect(() => {
    void fetchAssets();
  }, [fetchAssets]);

  return { assets, total, loading, error, refetch: fetchAssets };
}

/**
 * Hook for loading a single asset by ID with offline fallback.
 */
export function useAsset(id: string) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useNetworkStatus();

  const fetchAsset = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Try cache first
    const cached = await getCachedAssetById(id);
    if (cached) {
      setAsset(cached);
    }

    if (isConnected) {
      try {
        const result = await api.getAssetById(id);
        setAsset(result);
      } catch (err) {
        if (!cached) {
          setError(
            err instanceof Error
              ? err.message
              : 'Failed to load asset',
          );
        }
      }
    } else if (!cached) {
      setError('No internet connection and asset not cached');
    }

    setLoading(false);
  }, [id, isConnected]);

  useEffect(() => {
    void fetchAsset();
  }, [fetchAsset]);

  return { asset, loading, error, refetch: fetchAsset };
}
