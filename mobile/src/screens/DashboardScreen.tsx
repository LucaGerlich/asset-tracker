import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import * as api from '../api/client';
import { getCachedData, cacheData } from '../services/offline';
import { useAuth } from '../context/AuthContext';
import type { DashboardStats } from '../types';

export function DashboardScreen() {
  const { user } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    // Try cache first
    const cached = await getCachedData<DashboardStats>('dashboard');
    if (cached) setStats(cached);

    if (isConnected) {
      try {
        const data = await api.getDashboardStats();
        setStats(data);
        await cacheData('dashboard', data);
      } catch {
        // Use cached data if available
      }
    }
    setLoading(false);
  }, [isConnected]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  }, [fetchDashboard]);

  if (loading && !stats) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366f1"
          />
        }
      >
        <Text style={styles.greeting}>
          Welcome back{user?.firstname ? `, ${user.firstname}` : ''}
        </Text>

        <View style={styles.grid}>
          <StatCard
            title="Total Assets"
            value={stats?.totalAssets ?? 0}
            icon="📦"
            color="#6366f1"
          />
          <StatCard
            title="Checked Out"
            value={stats?.checkedOutAssets ?? 0}
            icon="📤"
            color="#f59e0b"
          />
          <StatCard
            title="Available"
            value={stats?.availableAssets ?? 0}
            icon="✅"
            color="#22c55e"
          />
          <StatCard
            title="Users"
            value={stats?.totalUsers ?? 0}
            icon="👥"
            color="#3b82f6"
          />
          <StatCard
            title="Licenses"
            value={stats?.totalLicenses ?? 0}
            icon="📄"
            color="#8b5cf6"
          />
          <StatCard
            title="Accessories"
            value={stats?.totalAccessories ?? 0}
            icon="🔧"
            color="#ec4899"
          />
        </View>

        {stats?.recentActivity && stats.recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {stats.recentActivity.slice(0, 10).map((item) => (
              <View key={item.id} style={styles.activityItem}>
                <Text style={styles.activityAction}>
                  {item.action}
                </Text>
                <Text style={styles.activityDetail} numberOfLines={1}>
                  {item.entityName} by {item.userName}
                </Text>
                <Text style={styles.activityTime}>
                  {new Date(item.timestamp).toLocaleDateString()}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    width: '47%',
    margin: '1.5%',
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: {
    fontSize: 22,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1e293b',
  },
  statTitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  activityItem: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  activityAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  activityDetail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 4,
  },
});
