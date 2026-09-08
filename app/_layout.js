import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import {
  useFonts,
  InstrumentSerif_400Regular,
  InstrumentSerif_400Regular_Italic,
} from '@expo-google-fonts/instrument-serif';
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Headers are hidden app-wide; every screen renders its own top bar (entry
// screens have none, pushed screens use <TopBar /> from components/ui).
// SafeAreaProvider supplies the real device insets to the <SafeAreaView />
// inside <Screen /> — RN's built-in SafeAreaView is a no-op on Android, which
// collides with the edge-to-edge display enabled in app.json.
export default function RootLayout() {
  // Custom families don't respond to fontWeight, so the type scale in
  // constants/theme.js names an explicit family per weight.
  const [fontsLoaded] = useFonts({
    InstrumentSerif_400Regular,
    InstrumentSerif_400Regular_Italic,
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  // Holding the splash until the faces land avoids a system-font flash.
  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
