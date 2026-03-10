export interface User {
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
}

export interface Asset {
  id: string;
  asset_tag: string;
  name: string;
  serial: string;
  model_id: string;
  status_id: string;
  category_id: string;
  location_id?: string;
  assigned_to?: string;
  purchase_date?: string;
  purchase_cost?: number;
  notes?: string;
  image?: string;
  created_at: string;
  updated_at: string;
  model?: Model;
  statusLabel?: StatusLabel;
  category?: Category;
  location?: Location;
  assignedUser?: User;
}

export interface Model {
  id: string;
  name: string;
  manufacturer_id?: string;
  manufacturer?: Manufacturer;
}

export interface Manufacturer {
  id: string;
  name: string;
}

export interface StatusLabel {
  id: string;
  name: string;
  color?: string;
}

export interface Category {
  id: string;
  name: string;
}

export interface Location {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}

export interface DashboardStats {
  totalAssets: number;
  checkedOutAssets: number;
  availableAssets: number;
  totalUsers: number;
  totalLicenses: number;
  totalAccessories: number;
  recentActivity: ActivityItem[];
}

export interface ActivityItem {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  entityName: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface SyncQueueItem {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  endpoint: string;
  body?: Record<string, unknown>;
  createdAt: string;
  retryCount: number;
}

export type AuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  serverUrl: string;
};

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  AssetDetail: { assetId: string };
  Scanner: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Assets: undefined;
  Scanner: undefined;
  Settings: undefined;
};
