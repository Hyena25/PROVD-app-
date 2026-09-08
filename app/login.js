import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../constants/theme';
import { Button, Card, Field, Screen } from '../components/ui';

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
    <Screen>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.head}>
            <View style={styles.brandRow}>
              <View style={styles.mark}>
                <Text style={styles.markGlyph}>P</Text>
              </View>
              <Text style={styles.brand}>Provd</Text>
            </View>
            <Text style={styles.tagline}>
              Dare your friends.{'\n'}Prove it. Win the crown.
            </Text>
          </View>

          <Card style={styles.card}>
            <Text style={styles.title}>Welcome back 👋</Text>
            <Text style={styles.subtitle}>Log in to keep your streak going.</Text>

            <View style={styles.form}>
              <Field
                label="Email"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                placeholder="you@example.com"
                editable={!submitting}
                returnKeyType="next"
              />

              <Field
                label="Password"
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                textContentType="password"
                autoComplete="current-password"
                placeholder="Your password"
                editable={!submitting}
                returnKeyType="go"
                onSubmitEditing={handleSubmit}
                error={error}
                style={styles.noGap}
              />

              <View style={styles.formMeta}>
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Text style={styles.metaLink}>
                    {showPassword ? 'Hide' : 'Show'} password
                  </Text>
                </Pressable>
                <Pressable onPress={handleForgot} hitSlop={8}>
                  <Text style={styles.metaLink}>Forgot?</Text>
                </Pressable>
              </View>

              <Button
                title="Log in"
                onPress={handleSubmit}
                loading={submitting}
              />

              <View style={styles.orRow}>
                <View style={styles.orLine} />
                <Text style={styles.orText}>or continue with</Text>
                <View style={styles.orLine} />
              </View>

              <View style={styles.socialRow}>
                <Button
                  title="Apple"
                  variant="secondary"
                  onPress={() => handleSocial('Apple')}
                  style={styles.socialBtn}
                />
                <Button
                  title="Google"
                  variant="secondary"
                  onPress={() => handleSocial('Google')}
                  style={styles.socialBtn}
                />
              </View>
            </View>
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No account yet? </Text>
            <Link href="/signup" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}>Sign up</Text>
              </Pressable>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: gutter,
    paddingBottom: space.xxl,
  },

  head: { paddingTop: space.lg, paddingBottom: space.xxl },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  markGlyph: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: '#FFFFFF',
    transform: [{ rotate: '-12deg' }],
  },
  brand: {
    fontFamily: fonts.sansBold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  tagline: {
    marginTop: space.lg,
    fontFamily: fonts.sansBold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: colors.ink,
  },

  card: {},
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  subtitle: { ...type.bodyMuted, marginTop: space.xs },

  form: { marginTop: space.xl },
  noGap: { marginBottom: space.sm },

  formMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: space.lg,
  },
  metaLink: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.muted,
  },

  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginVertical: space.lg,
  },
  orLine: { flex: 1, height: 1, backgroundColor: colors.line },
  orText: { fontFamily: fonts.sans, fontSize: 12, color: colors.muted },

  socialRow: { flexDirection: 'row', gap: space.md },
  socialBtn: { flex: 1, paddingHorizontal: space.md },

  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: space.xxl,
  },
  footerText: { fontFamily: fonts.sans, fontSize: 13.5, color: colors.muted },
  footerLink: {
    fontFamily: fonts.sansBold,
    fontSize: 13.5,
    color: colors.accent,
  },
});
