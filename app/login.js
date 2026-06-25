import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { colors, shadows } from '../constants/theme';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(null); // 'email' | 'password' | null
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (signInError) throw signInError;
      router.replace('/');
    } catch (err) {
      setError(err?.message ?? 'Sign in failed. Check your email and password.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSocial(provider) {
    Alert.alert(
      `Continue with ${provider}`,
      "Social sign-in isn't wired up in this build yet — use your email and password for now."
    );
  }

  function handleForgot() {
    Alert.alert(
      'Reset password',
      "Password reset isn't set up in this build yet."
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <LinearGradient
            colors={[colors.accent, colors.dark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.brand}>Provd</Text>
            <Text style={styles.tagline}>
              Dare your friends. Prove it. Win the crown.
            </Text>
          </LinearGradient>

          <View style={styles.sheet}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to keep your streak going.</Text>

            <Text style={styles.label}>Email</Text>
            <View
              style={[styles.field, focused === 'email' && styles.fieldFocused]}
            >
              <Ionicons
                name="mail-outline"
                size={20}
                color={focused === 'email' ? colors.accent : colors.textMuted}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                placeholder="you@example.com"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
                returnKeyType="next"
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View
              style={[
                styles.field,
                focused === 'password' && styles.fieldFocused,
              ]}
            >
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={focused === 'password' ? colors.accent : colors.textMuted}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                placeholder="Your password"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={10}
                disabled={submitting}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              onPress={handleForgot}
              hitSlop={8}
              style={styles.forgotWrap}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </Pressable>

            {error && <Text style={styles.error}>{error}</Text>}

            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [
                styles.button,
                (submitting || pressed) && styles.buttonPressed,
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Log in</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialRow}>
              <Pressable
                onPress={() => handleSocial('Apple')}
                style={({ pressed }) => [
                  styles.socialButton,
                  styles.socialApple,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="logo-apple" size={20} color={colors.background} />
                <Text style={styles.socialAppleText}>Apple</Text>
              </Pressable>
              <Pressable
                onPress={() => handleSocial('Google')}
                style={({ pressed }) => [
                  styles.socialButton,
                  styles.socialGoogle,
                  pressed && styles.buttonPressed,
                ]}
              >
                <Ionicons name="logo-google" size={20} color="#4285F4" />
                <Text style={styles.socialGoogleText}>Google</Text>
              </Pressable>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don&apos;t have an account? </Text>
              <Link href="/signup" style={styles.footerLink}>
                Sign up
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.dark },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: colors.background },

  hero: {
    paddingTop: Platform.OS === 'ios' ? 88 : 72,
    paddingBottom: 56,
    paddingHorizontal: 28,
  },
  brand: {
    fontSize: 44,
    fontWeight: '800',
    color: colors.background,
    letterSpacing: -1,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
    maxWidth: 260,
  },

  sheet: {
    flex: 1,
    marginTop: -28,
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 32,
  },

  title: { fontSize: 28, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 20,
  },

  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 14,
    marginBottom: 6,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 54,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  fieldFocused: {
    borderColor: colors.accent,
    backgroundColor: colors.background,
    ...shadows.card,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    height: '100%',
  },

  forgotWrap: { alignSelf: 'flex-end', marginTop: 12 },
  forgotText: { color: colors.accent, fontSize: 13, fontWeight: '600' },

  error: { color: colors.danger, fontSize: 13, marginTop: 14 },

  button: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 18,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.textMuted, opacity: 0.4 },
  dividerText: {
    marginHorizontal: 12,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },

  socialRow: { flexDirection: 'row', gap: 12 },
  socialButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
  },
  socialApple: { backgroundColor: colors.dark },
  socialAppleText: { color: colors.background, fontSize: 15, fontWeight: '700' },
  socialGoogle: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  socialGoogleText: { color: colors.dark, fontSize: 15, fontWeight: '700' },

  footer: {
    marginTop: 'auto',
    paddingTop: 28,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: { color: colors.textMuted, fontSize: 14 },
  footerLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
