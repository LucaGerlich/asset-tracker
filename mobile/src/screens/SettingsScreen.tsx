import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import {
  clearAllCache,
  clearSyncQueue,
  getLastSyncTimestamp,
  getSyncQueue,
} from '../services/offline';
import { registerForPushNotifications } from '../services/notifications';
import { syncAssets, processQueue } from '../services/sync';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function SettingsScreen() {
  const { user, logout, serverUrl } = useAuth();
  const { isConnected } = useNetworkStatus();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  React.useEffect(() => {
    void loadSyncInfo();
  }, []);

  async function loadSyncInfo() {
    const timestamp = await getLastSyncTimestamp();
    setLastSync(timestamp);
    const queue = await getSyncQueue();
    setPendingCount(queue.length);
  }

  async function handleTogglePush(value: boolean) {
    if (value) {
      const token = await registerForPushNotifications();
      if (token) {
        setPushEnabled(true);
      } else {
        Alert.alert(
          'Push Notifications',
          'Unable to enable push notifications. Please check device permissions.',
        );
      }
    } else {
      setPushEnabled(false);
    }
  }

  async function handleSyncNow() {
    if (!isConnected) {
      Alert.alert('Offline', 'Cannot sync while offline');
      return;
    }
    await processQueue();
    await syncAssets();
    await loadSyncInfo();
    Alert.alert('Sync Complete', 'Data has been synced with the server');
  }

  async function handleClearCache() {
    Alert.alert(
      'Clear Cache',
      'This will remove all locally cached data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            await clearAllCache();
            await clearSyncQueue();
            await loadSyncInfo();
          },
        },
      ],
    );
  }

  async function handleLogout() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Profile */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstname?.[0] ?? ''}
              {user?.lastname?.[0] ?? ''}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {user?.firstname} {user?.lastname}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            {user?.isadmin && (
              <Text style={styles.adminBadge}>Administrator</Text>
            )}
          </View>
        </View>
      </View>

      {/* Server */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Server</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Server URL</Text>
          <Text style={styles.rowValue} numberOfLines={1}>
            {serverUrl}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Status</Text>
          <Text
            style={[
              styles.rowValue,
              { color: isConnected ? '#22c55e' : '#ef4444' },
            ]}
          >
            {isConnected ? 'Connected' : 'Offline'}
          </Text>
        </View>
      </View>

      {/* Sync */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Sync & Storage</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Last Synced</Text>
          <Text style={styles.rowValue}>
            {lastSync
              ? new Date(lastSync).toLocaleString()
              : 'Never'}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Pending Changes</Text>
          <Text style={styles.rowValue}>{pendingCount}</Text>
        </View>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={handleSyncNow}
        >
          <Text style={styles.actionButtonText}>Sync Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.secondaryButton]}
          onPress={handleClearCache}
        >
          <Text style={styles.secondaryButtonText}>
            Clear Local Cache
          </Text>
        </TouchableOpacity>
      </View>

      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Push Notifications</Text>
          <Switch
            value={pushEnabled}
            onValueChange={handleTogglePush}
            trackColor={{ false: '#cbd5e1', true: '#6366f1' }}
            thumbColor="#ffffff"
          />
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutButton}
        onPress={handleLogout}
      >
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Asset Tracker Mobile v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  adminBadge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  rowLabel: {
    fontSize: 14,
    color: '#475569',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    maxWidth: '55%',
    textAlign: 'right',
  },
  actionButton: {
    backgroundColor: '#6366f1',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  actionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  secondaryButtonText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 16,
    fontWeight: '600',
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94a3b8',
  },
});
