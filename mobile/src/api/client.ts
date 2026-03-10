import * as SecureStore from 'expo-secure-store';
import type { Asset, DashboardStats } from '../types';

const SESSION_KEY = 'auth_session_token';
const SERVER_URL_KEY = 'server_url';

let serverUrl = '';

export async function getServerUrl(): Promise<string> {
  if (serverUrl) return serverUrl;
  const stored = await SecureStore.getItemAsync(SERVER_URL_KEY);
  serverUrl = stored || '';
  return serverUrl;
}

export async function setServerUrl(url: string): Promise<void> {
  const normalized = url.replace(/\/+$/, '');
  serverUrl = normalized;
  await SecureStore.setItemAsync(SERVER_URL_KEY, normalized);
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function setSessionToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_KEY, token);
}

export async function clearSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_KEY);
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const base = await getServerUrl();
  if (!base) {
    throw new Error('Server URL not configured');
  }

  const token = await getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Cookie'] = `better-auth.session_token=${token}`;
  }

  const response = await fetch(`${base}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (response.status === 401) {
      await clearSession();
      throw new Error('Unauthorized');
    }
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error ${response.status}: ${errorBody}`);
  }

  const text = await response.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

// Auth
export interface LoginResponse {
  token: string;
  user: {
    id: string;
    userid: string;
    firstname: string;
    lastname: string;
    username: string;
    email: string;
    image?: string;
    isadmin: boolean;
    canrequest: boolean;
    organizationId?: string;
    departmentId?: string;
  };
}

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const base = await getServerUrl();
  const response = await fetch(`${base}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `Login failed with status ${response.status}`);
  }

  const setCookie = response.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(
    /better-auth\.session_token=([^;]+)/,
  );
  const token = tokenMatch ? tokenMatch[1] : '';

  const data = await response.json();

  if (token) {
    await setSessionToken(token);
  }

  return { token, user: data.user };
}

export async function logout(): Promise<void> {
  try {
    await request('/api/auth/sign-out', { method: 'POST' });
  } finally {
    await clearSession();
  }
}

export async function getCurrentUser(): Promise<LoginResponse['user']> {
  return request<LoginResponse['user']>('/api/auth/get-session');
}

// Dashboard
export async function getDashboardStats(): Promise<DashboardStats> {
  return request<DashboardStats>('/api/dashboard');
}

// Assets
export async function getAssets(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{ assets: Asset[]; total: number }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.status) searchParams.set('status', params.status);
  const query = searchParams.toString();
  return request<{ assets: Asset[]; total: number }>(
    `/api/asset${query ? `?${query}` : ''}`,
  );
}

export async function getAssetById(id: string): Promise<Asset> {
  return request<Asset>(`/api/asset/getAsset?id=${encodeURIComponent(id)}`);
}

export async function getAssetByTag(tag: string): Promise<Asset> {
  return request<Asset>(
    `/api/asset/getAsset?asset_tag=${encodeURIComponent(tag)}`,
  );
}

export async function updateAssetStatus(
  id: string,
  statusId: string,
): Promise<Asset> {
  return request<Asset>('/api/asset/updateStatus', {
    method: 'PATCH',
    body: JSON.stringify({ id, status_id: statusId }),
  });
}

export async function checkoutAsset(
  assetId: string,
  userId: string,
  notes?: string,
): Promise<void> {
  await request(`/api/asset/checkout/${assetId}`, {
    method: 'POST',
    body: JSON.stringify({ userId, notes }),
  });
}

// Search
export async function searchAssets(query: string): Promise<Asset[]> {
  return request<Asset[]>(
    `/api/search?q=${encodeURIComponent(query)}&type=assets`,
  );
}
