import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import * as api from '../api/client';
import type { RootStackParamList } from '../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function ScannerScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [processing, setProcessing] = useState(false);

  const handleBarCodeScanned = useCallback(
    async ({ data }: { type: string; data: string }) => {
      if (scanned || processing) return;
      setScanned(true);
      setProcessing(true);

      try {
        // Try to parse QR data – could be an asset tag, URL, or JSON
        let assetId: string | null = null;

        // Check if it's a URL containing an asset ID
        const urlMatch = data.match(/\/assets?\/([a-zA-Z0-9-]+)/);
        if (urlMatch) {
          assetId = urlMatch[1];
        }

        // Check if it's a JSON payload with an id field
        if (!assetId) {
          try {
            const parsed = JSON.parse(data) as Record<string, string>;
            assetId = parsed.id || parsed.asset_id || parsed.assetId;
          } catch {
            // Not valid JSON – fall through to treat as raw asset tag
          }
        }

        // If still no ID, treat the raw data as an asset tag and look it up
        if (!assetId) {
          try {
            const asset = await api.getAssetByTag(data);
            assetId = asset.id;
          } catch {
            Alert.alert(
              'Asset Not Found',
              `No asset found for: ${data}`,
              [{ text: 'Scan Again', onPress: () => setScanned(false) }],
            );
            setProcessing(false);
            return;
          }
        }

        navigation.navigate('AssetDetail', { assetId });
      } catch (err) {
        Alert.alert(
          'Scan Error',
          err instanceof Error ? err.message : 'Failed to process QR code',
          [{ text: 'Try Again', onPress: () => setScanned(false) }],
        );
      } finally {
        setProcessing(false);
      }
    },
    [scanned, processing, navigation],
  );

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionTitle}>Camera Permission</Text>
        <Text style={styles.permissionText}>
          Asset Tracker needs camera access to scan QR codes on assets.
        </Text>
        <TouchableOpacity
          style={styles.permissionButton}
          onPress={requestPermission}
        >
          <Text style={styles.permissionButtonText}>
            Grant Permission
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{
          barcodeTypes: ['qr', 'code128', 'code39', 'ean13'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        <View style={styles.overlay}>
          <View style={styles.header}>
            <Text style={styles.headerText}>Scan Asset QR Code</Text>
            <Text style={styles.headerSubtext}>
              Point the camera at a QR code or barcode
            </Text>
          </View>

          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>

          {processing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#ffffff" />
              <Text style={styles.processingText}>
                Looking up asset...
              </Text>
            </View>
          )}

          {scanned && !processing && (
            <TouchableOpacity
              style={styles.rescanButton}
              onPress={() => setScanned(false)}
            >
              <Text style={styles.rescanText}>Tap to Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>
      </CameraView>
    </View>
  );
}

const SCAN_SIZE = 260;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
    padding: 32,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 80,
    alignItems: 'center',
  },
  headerText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  headerSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 6,
  },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderColor: '#6366f1',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  processingOverlay: {
    position: 'absolute',
    bottom: 120,
    alignItems: 'center',
  },
  processingText: {
    color: '#ffffff',
    fontSize: 15,
    marginTop: 10,
  },
  rescanButton: {
    position: 'absolute',
    bottom: 120,
    backgroundColor: '#6366f1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  rescanText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  permissionTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
  },
  permissionText: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
