import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/theme';

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
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Pick a username your friends will recognize.
          </Text>

          <Text style={styles.label}>Username</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="provdfan42"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!submitting}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            placeholder="At least 6 characters"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            editable={!submitting}
          />

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
              <Text style={styles.buttonText}>Sign up</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: '700', color: colors.dark },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 16,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    marginTop: 6,
  },
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
