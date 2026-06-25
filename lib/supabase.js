import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { createMockSupabase } from './mockSupabase';

// ---------------------------------------------------------------------------
// BACKEND TOGGLE (testing)
// ---------------------------------------------------------------------------
// The third-party backend (Supabase) is currently PAUSED for local testing so
// you can sign up / log in with any credentials and browse the app without a
// live database.
//
// To switch back to the real Supabase backend, either:
//   • set EXPO_PUBLIC_USE_MOCK_BACKEND=false in .env, or
//   • change the default below to 'false'
// Then restart the Expo dev server.
//
// All real Supabase code below is kept intact — only which client we export
// changes.
// ---------------------------------------------------------------------------
export const USE_MOCK_BACKEND =
  (process.env.EXPO_PUBLIC_USE_MOCK_BACKEND ?? 'true') !== 'false';

function createRealClient() {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Add them to .env at the project root.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = USE_MOCK_BACKEND
  ? createMockSupabase()
  : createRealClient();

if (USE_MOCK_BACKEND && __DEV__) {
  console.log(
    '[provd] Using MOCK backend — sign in/up with any credentials. ' +
      'Set EXPO_PUBLIC_USE_MOCK_BACKEND=false to use real Supabase.'
  );
}
