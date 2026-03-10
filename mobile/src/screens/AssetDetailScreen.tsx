import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAsset } from '../hooks/useAssets';
import { StatusBadge } from '../components/StatusBadge';
import { OfflineBanner } from '../components/OfflineBanner';
import type { RootStackParamList } from '../types';

type Props = NativeStackScreenProps<RootStackParamList, 'AssetDetail'>;

export function AssetDetailScreen({ route }: Props) {
  const { assetId } = route.params;
  const { asset, loading, error, refetch } = useAsset(assetId);
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  if (loading && !asset) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error && !asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!asset) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Asset not found</Text>
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
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <Text style={styles.assetTag}>{asset.asset_tag}</Text>
            {asset.statusLabel && (
              <StatusBadge label={asset.statusLabel.name} />
            )}
          </View>
          <Text style={styles.assetName}>{asset.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Details</Text>
          <DetailRow label="Serial Number" value={asset.serial} />
          <DetailRow
            label="Model"
            value={asset.model?.name}
          />
          <DetailRow
            label="Manufacturer"
            value={asset.model?.manufacturer?.name}
          />
          <DetailRow
            label="Category"
            value={asset.category?.name}
          />
          <DetailRow
            label="Location"
            value={asset.location?.name}
          />
          {asset.purchase_date && (
            <DetailRow
              label="Purchase Date"
              value={new Date(asset.purchase_date).toLocaleDateString()}
            />
          )}
          {asset.purchase_cost !== undefined &&
            asset.purchase_cost !== null && (
              <DetailRow
                label="Purchase Cost"
                value={`$${asset.purchase_cost.toFixed(2)}`}
              />
            )}
        </View>

        {asset.assignedUser && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned To</Text>
            <DetailRow
              label="Name"
              value={`${asset.assignedUser.firstname} ${asset.assignedUser.lastname}`}
            />
            <DetailRow
              label="Email"
              value={asset.assignedUser.email}
            />
          </View>
        )}

        {asset.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes</Text>
            <Text style={styles.notes}>{asset.notes}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    textAlign: 'center',
    padding: 24,
  },
  content: {
    padding: 16,
  },
  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  assetTag: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  assetName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
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
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  detailLabel: {
    fontSize: 14,
    color: '#64748b',
    flex: 1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
    textAlign: 'right',
  },
  notes: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 22,
  },
});
