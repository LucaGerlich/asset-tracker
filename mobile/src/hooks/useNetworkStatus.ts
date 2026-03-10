import { useState, useEffect, useCallback } from 'react';
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';

/**
 * Hook that tracks online/offline connectivity state.
 */
export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [connectionType, setConnectionType] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);
    });
    return () => unsubscribe();
  }, []);

  const checkConnection = useCallback(async () => {
    const state = await NetInfo.fetch();
    setIsConnected(state.isConnected ?? false);
    setConnectionType(state.type);
    return state.isConnected ?? false;
  }, []);

  return { isConnected, connectionType, checkConnection };
}
