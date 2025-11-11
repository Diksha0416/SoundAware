# SoundAware 

<img width="1919" height="857" alt="Screenshot 2025-09-22 232844" src="https://github.com/user-attachments/assets/f9d587fa-44dc-4307-b3d3-de67a3d2c204" />

SoundAware is a mobile app built with Expo (React Native) using Expo Router. This README explains how to install dependencies, run the project, and use the app on a physical mobile device on the same Wi‑Fi/LAN as your laptop so the LAN IP is reachable.


## Features (Overview)
- Chatbot and history UI (`app/(tabs)/chatbot.tsx`, `app/(tabs)/history.tsx`)
- Audio visualization components (`components/ui/AudioVisualizer.tsx`)
- Multi-language infrastructure (`contexts/LanguageContext.tsx`, `i18n-js`)
- Expo modules such as `expo-av`, `expo-camera`, `expo-file-system`, `expo-speech`, `expo-haptics`, etc.
- Navigation via `expo-router` and `@react-navigation/*`


Important config files:
- `package.json` – scripts and dependencies
- `app.json` – Expo config (name, icon, plugins, web bundler, etc.)


## Prerequisites
- Node.js LTS (>= 18 recommended)
- npm (bundled with Node) or yarn/pnpm (optional)
- Expo CLI (you can use `npx` without a global install)
- Android or iOS device:
  - Android: Expo Go app on a physical device (from Play Store) or an Android Emulator (Android Studio).
  - iOS: Expo Go on a physical device (App Store) or Xcode Simulator (macOS only).

Windows tips:
- Set up ADB/Emulator via Android Studio if needed (optional; Expo Go on a physical device is easiest).
- Allow Node/Expo through Windows Firewall on Private networks so the LAN dev server is reachable.


## Install
1. Install dependencies:
   ```bash
   npm install
   ```
2. If you’re behind a corporate proxy/VPN, ensure your `npm`/`git` proxy settings are correct.


## Run (Development)
Start the local development server:
```bash
npx expo start -c
```
This runs `expo start` and shows a QR code and connection options (LAN/Tunnel/Local).


## Run on a Mobile Device (Same Wi‑Fi/LAN Required)
Your mobile device and laptop must be on the same Wi‑Fi network. This ensures the Expo dev server’s LAN IP is reachable from your phone.

record.tsx
const BACKEND_BASE = (global as any).BACKEND_URL || 'http://xxx.xxx.xx.xx:5000';
Replace xxx.xxx.xx.xx with your IP Address of the Devices.

index.js
global.BACKEND_URL = 'http://xx.xx.xx.xx:5000';
Replace xxx.xxx.xx.xx with your IP Address of the Devices.

Steps:
1. Connect both devices to the same Wi‑Fi (same router SSID). Guest networks/hotspots may restrict LAN access.
2. After `npx expo start -c`, the Expo Dev Tools open. Keep the connection type as "LAN" (default). If LAN is blocked, allow through Firewall or temporarily switch to "Tunnel" (slower, uses internet).
3. Open Expo Go on your phone:
   - Android: Scan the QR code from the Dev Tools.
   - iOS: Use the Camera app to scan the QR and open in Expo Go.
4. The app will load automatically. Hot reload/Fast Refresh will be active.

Tips:
- If it fails after scanning the QR, the Dev Tools show a URL like `exp://<YOUR_LAPTOP_LAN_IP>:<PORT>`. Ensure `<YOUR_LAPTOP_LAN_IP>` is your laptop’s private IP (e.g., 192.168.x.x) and reachable on the same Wi‑Fi.
- When prompted by Windows Firewall, choose "Allow access" for Private networks.
- VPN/Firewall/Antivirus can block LAN traffic; temporarily disable or add allow rules if needed.


## Run on Web (Optional)
You can also test on the web:
- Dev server as web:
  ```bash
  npx expo start --web
  ```
- Static web export (production-like):
  ```bash
  npm run build:web
  ```
  The output will be in `dist/` (Expo export default output).


## Directory Structure (High-level)
- `app/` – Expo Router screens & layouts
  - `app/(tabs)/` – Tab-based routes (e.g., `chatbot.tsx`, `history.tsx`)
  - `_layout.tsx` – Root/tab layouts
- `assets/` – Images, icons, favicons
- `components/ui/` – Reusable UI components (Button, Card, AudioVisualizer, etc.)
- `contexts/` – React contexts (AI Assistant, Language, ML Model, Notification, etc.)
- `hooks/` – Custom hooks (e.g., `useFrameworkReady.ts`)
- `types/` – Shared TypeScript types
- `index.js`, `babel.config.js`, `tsconfig.json` – Project setup/config



## Useful Commands
```bash
# Start dev (default)
npm run dev

# Start web dev
npx expo start --web

# Clear Metro cache (fix common issues)
expo start -c

# Upgrade Expo SDK (interactive)
npx expo upgrade
```

