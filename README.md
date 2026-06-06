# Provd

Provd is a social dare challenge app. Friends dare each other to complete real-world tasks, submit photo or video proof, and earn points toward a monthly crown. An Arena mode lets strangers dare each other.

## Tech stack

- React Native + Expo (SDK 54)
- expo-router (file-based routing in `/app`)
- Supabase (`@supabase/supabase-js`) for database and auth
- `expo-image-picker` for proof capture
- `dayjs` for date handling
- `react-native-reanimated` for animations

## Folder structure

```
/app          screens (expo-router file-based routing)
/components   reusable UI components
/lib          utilities, supabase client, helpers
/hooks        custom React hooks
/constants    theme.js, config values
/api          all Supabase calls and API logic
```

## Prerequisites

- Node.js 20+
- npm 10+
- The Expo Go app on a physical iOS or Android device, or an iOS Simulator (Xcode) / Android Emulator (Android Studio)

## Run it locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the dev server:

   ```bash
   npm start
   ```

3. From the Metro UI in the terminal, choose how to open the app:
   - Scan the QR code with Expo Go (iOS Camera app or Expo Go on Android)
   - Press `i` to open the iOS Simulator
   - Press `a` to open the Android Emulator
   - Press `w` to open in a web browser

### Direct platform shortcuts

```bash
npm run ios       # iOS Simulator
npm run android   # Android Emulator
npm run web       # Browser
```

## Environment variables

Create a `.env` file in the project root with your Supabase credentials:

```
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

These are read at runtime by the Supabase client in `/lib`.
