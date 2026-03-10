# Asset Tracker Mobile

React Native mobile application for Asset Tracker, built with [Expo](https://expo.dev/).

## Features

- **Asset Management** – Browse, search, and view asset details
- **QR Code Scanning** – Scan asset QR codes and barcodes using the device camera
- **Offline-First** – Local caching with background sync when connectivity is restored
- **Push Notifications** – Receive alerts for asset updates and assignments
- **Cross-Platform** – Runs on both iOS and Android from a single codebase

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Expo CLI](https://docs.expo.dev/get-started/installation/) (`npm install -g expo-cli`)
- iOS Simulator (macOS) or Android Emulator, or [Expo Go](https://expo.dev/go) on a physical device
- A running Asset Tracker server instance

## Getting Started

```bash
# Navigate to the mobile directory
cd mobile

# Install dependencies
npm install

# Start the development server
npx expo start
```

Scan the QR code with Expo Go (Android) or the Camera app (iOS) to open the app on your device.

### Connecting to Your Server

On the login screen, enter the URL of your Asset Tracker server instance (e.g., `https://assets.yourcompany.com`) before signing in.

## Project Structure

```
mobile/
├── App.tsx                        # App entry point
├── app.json                       # Expo configuration
├── eas.json                       # EAS Build configuration
├── src/
│   ├── api/client.ts              # API client with auth headers
│   ├── components/                # Reusable UI components
│   │   ├── AssetCard.tsx
│   │   ├── OfflineBanner.tsx
│   │   └── StatusBadge.tsx
│   ├── context/AuthContext.tsx     # Authentication state provider
│   ├── hooks/                     # Custom React hooks
│   │   ├── useAssets.ts           # Asset data with offline fallback
│   │   └── useNetworkStatus.ts    # Connectivity tracking
│   ├── navigation/
│   │   └── AppNavigator.tsx       # Stack + tab navigation
│   ├── screens/
│   │   ├── LoginScreen.tsx        # Server URL + credentials
│   │   ├── DashboardScreen.tsx    # Stats overview
│   │   ├── AssetsScreen.tsx       # Asset list with search
│   │   ├── AssetDetailScreen.tsx  # Single asset view
│   │   ├── ScannerScreen.tsx      # QR / barcode scanner
│   │   └── SettingsScreen.tsx     # Account, sync, notifications
│   ├── services/
│   │   ├── offline.ts             # AsyncStorage caching + queue
│   │   ├── sync.ts                # Background sync engine
│   │   └── notifications.ts       # Push notification setup
│   └── types/index.ts             # TypeScript interfaces
└── assets/                        # App icons and splash screen
```

## Architecture

### Offline-First

1. **Cache-first reads** – Screens load from AsyncStorage immediately, then refresh from the network.
2. **Mutation queue** – Write operations made offline are queued in `SyncQueue` and replayed when connectivity returns.
3. **Background sync** – A `NetInfo` listener triggers queue processing and cache refresh on reconnect, with periodic polling as a fallback.
4. **Retry with backoff** – Failed queue items are retried up to 5 times before being discarded.

### Authentication

The app authenticates against the Asset Tracker BetterAuth API (`/api/auth/sign-in/email`) and stores the session token in `expo-secure-store` for secure, encrypted persistence.

### Push Notifications

Expo Notifications handles permission requests and token registration. The push token can be sent to the server to enable remote notifications for asset assignments, checkout reminders, and maintenance alerts.

## Building for App Stores

This project uses [EAS Build](https://docs.expo.dev/build/introduction/) for cloud-based native builds.

```bash
# Install EAS CLI
npm install -g eas-cli

# Log in to your Expo account
eas login

# Configure the project (first time only)
eas build:configure

# Build for iOS
eas build --platform ios --profile production

# Build for Android
eas build --platform android --profile production

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

### Build Profiles

| Profile       | Purpose                                  |
|---------------|------------------------------------------|
| `development` | Development client with debugging tools  |
| `preview`     | Internal distribution for testing        |
| `production`  | App store release builds                 |

## Environment Configuration

The server URL is configured at runtime through the login screen and stored securely on the device. No build-time environment variables are required.

## Testing

```bash
# Run unit tests
npm test

# Type check
npm run typecheck
```
