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
import { createGroup } from '../api/groupApi';

const MAX_NAME_LENGTH = 30;

export default function CreateGroup() {
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [createdGroup, setCreatedGroup] = useState(null);

  async function handleSubmit() {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Please enter a group name.');
      return;
    }
    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(`Group name must be ${MAX_NAME_LENGTH} characters or fewer.`);
      return;
    }

    setSubmitting(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('You must be signed in to create a group.');

      const group = await createGroup({ name: trimmed, creatorId: user.id });
      setCreatedGroup(group);
    } catch (err) {
      setError(err?.message ?? 'Could not create the group. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleContinue() {
    if (createdGroup) router.replace(`/group/${createdGroup.id}`);
  }

  if (createdGroup) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Group created</Text>
          <Text style={styles.subtitle}>
            Share this invite code so friends can join {createdGroup.name}.
          </Text>

          <View style={styles.codeBox}>
            <Text style={styles.code}>{createdGroup.invite_code}</Text>
            <Text style={styles.codeLabel}>Invite code</Text>
          </View>

          <Pressable
            onPress={handleContinue}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          >
            <Text style={styles.buttonText}>Continue to group</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>New group</Text>
          <Text style={styles.subtitle}>
            Give your group a name your friends will recognize.
          </Text>

          <Text style={styles.label}>Group name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Sunday Squad"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            maxLength={MAX_NAME_LENGTH}
            editable={!submitting}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <Text style={styles.helper}>
            {name.length}/{MAX_NAME_LENGTH}
          </Text>

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
              <Text style={styles.buttonText}>Create group</Text>
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
    marginBottom: 24,
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
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
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

  codeBox: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  code: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: 6,
    color: colors.dark,
  },
  codeLabel: {
    marginTop: 8,
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
