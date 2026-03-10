import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import * as api from '../api/client';
import type { AuthState, User } from '../types';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setServerUrl: (url: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    serverUrl: '',
  });

  useEffect(() => {
    void checkSession();
  }, []);

  async function checkSession() {
    try {
      const serverUrl = await api.getServerUrl();
      if (!serverUrl) {
        setState((prev) => ({ ...prev, isLoading: false, serverUrl: '' }));
        return;
      }

      const token = await api.getSessionToken();
      if (!token) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          serverUrl,
        }));
        return;
      }

      const user = await api.getCurrentUser();
      setState({
        isAuthenticated: true,
        isLoading: false,
        user: user as User,
        serverUrl,
      });
    } catch {
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
        isLoading: false,
        user: null,
      }));
    }
  }

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      const result = await api.login(email, password);
      setState((prev) => ({
        ...prev,
        isAuthenticated: true,
        user: result.user as User,
      }));
    },
    [],
  );

  const handleLogout = useCallback(async () => {
    await api.logout();
    setState((prev) => ({
      ...prev,
      isAuthenticated: false,
      user: null,
    }));
  }, []);

  const handleSetServerUrl = useCallback(async (url: string) => {
    await api.setServerUrl(url);
    setState((prev) => ({ ...prev, serverUrl: url }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login: handleLogin,
        logout: handleLogout,
        setServerUrl: handleSetServerUrl,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
