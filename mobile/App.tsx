import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "./src/context/AuthContext";
import { AppNavigator } from "./src/navigation/AppNavigator";
import { startBackgroundSync, stopBackgroundSync } from "./src/services/sync";
import {
  registerForPushNotifications,
  addNotificationResponseListener,
} from "./src/services/notifications";

export default function App() {
  useEffect(() => {
    startBackgroundSync();

    // Register for push notifications
    void registerForPushNotifications();

    const subscription = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data;
      // Navigation to specific screens can be handled here based on notification data
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
