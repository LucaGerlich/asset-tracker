import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import {
  startBackgroundSync,
  stopBackgroundSync,
} from './src/services/sync';
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from './src/services/notifications';

export default function App() {
  useEffect(() => {
    // Start background sync for offline-first architecture
    startBackgroundSync();

    // Register for push notifications
    void registerForPushNotifications();

    // Handle notification taps
    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      // Navigation to specific screens can be handled here based on notification data
      console.log('Notification tapped:', data);
    });

    return () => {
      stopBackgroundSync();
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AppNavigator />
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
