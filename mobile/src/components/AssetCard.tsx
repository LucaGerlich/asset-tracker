import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import type { Asset } from '../types';
import { StatusBadge } from './StatusBadge';

interface AssetCardProps {
  asset: Asset;
  onPress: (asset: Asset) => void;
}

export function AssetCard({ asset, onPress }: AssetCardProps) {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(asset)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.assetTag}>{asset.asset_tag}</Text>
        {asset.statusLabel && (
          <StatusBadge
            label={asset.statusLabel.name}
            variant={getStatusVariant(asset.statusLabel.name)}
          />
        )}
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {asset.name}
      </Text>
      {asset.model && (
        <Text style={styles.detail} numberOfLines={1}>
          {asset.model.name}
          {asset.model.manufacturer
            ? ` · ${asset.model.manufacturer.name}`
            : ''}
        </Text>
      )}
      {asset.serial && (
        <Text style={styles.serial} numberOfLines={1}>
          S/N: {asset.serial}
        </Text>
      )}
      {asset.location && (
        <Text style={styles.detail} numberOfLines={1}>
          📍 {asset.location.name}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function getStatusVariant(
  status: string,
): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const lower = status.toLowerCase();
  if (lower.includes('available') || lower.includes('ready'))
    return 'success';
  if (lower.includes('deployed') || lower.includes('checked out'))
    return 'info';
  if (lower.includes('maintenance') || lower.includes('pending'))
    return 'warning';
  if (lower.includes('retired') || lower.includes('broken'))
    return 'danger';
  return 'default';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 } as ViewStyle['shadowOffset'],
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  assetTag: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  detail: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  serial: {
    fontSize: 12,
    color: '#94a3b8',
    fontFamily: 'monospace',
    marginTop: 2,
  },
});
