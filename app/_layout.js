import { Stack } from 'expo-router';

// Headers are hidden app-wide; every screen renders its own top bar (entry
// screens have none, pushed screens use the shared <BackBar /> component).
export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
