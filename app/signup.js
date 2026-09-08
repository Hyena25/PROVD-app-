import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Link, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, fonts, gutter, space, type } from '../constants/theme';
import { Button, Card, Field, Screen, TopBar } from '../components/ui';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanUsername || !cleanEmail || !password) {
      setError('Username, email, and password are all required.');
      return;
    }

    setSubmitting(true);
    try {
      const { data: available, error: rpcError } = await supabase.rpc(
        'is_username_available',
        { p_username: cleanUsername }
      );
      if (rpcError) throw rpcError;
      if (!available) {
        setError('That username is already taken. Try another.');
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
      });
      if (signUpError) throw signUpError;

      const userId = signUpData.user?.id;
      if (!userId) {
        setError('Sign up did not return a user. Please try again.');
        return;
      }

      if (!signUpData.session) {
        setError(
          'Account created. Check your email to confirm, then log in to finish setup.'
        );
        return;
      }

      const { error: insertError } = await supabase
        .from('users')
        .insert({ id: userId, username: cleanUsername });
      if (insertError) throw insertError;

      router.replace('/');
    } catch (err) {
      setError(err?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <TopBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Pick a username your friends will recognise.
          </Text>

          <Card style={styles.card}>
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              autoComplete="username"
              placeholder="provdfan42"
              editable={!submitting}
            />
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              placeholder="you@example.com"
              editable={!submitting}
            />
            <Field
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              textContentType="newPassword"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              editable={!submitting}
              error={error}
            />
            <Button
              title="Create account"
              onPress={handleSubmit}
              loading={submitting}
            />
          </Card>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" asChild>
              <Pressable hitSlop={8}>
                <Text style={styles.footerLink}>Log in</Text>
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
  scroll: { flexGrow: 1, paddingHorizontal: gutter, paddingBottom: space.xxl },
  title: { ...type.display, fontSize: 32, lineHeight: 38 },
  subtitle: { ...type.bodyMuted, marginTop: space.sm, marginBottom: space.xl },
  card: {},
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
