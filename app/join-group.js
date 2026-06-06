import { useEffect, useState } from 'react';
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
import { colors } from '../constants/theme';
import {
  lookupGroupByInviteCode,
  joinGroupByInviteCode,
} from '../api/groupApi';

const CODE_LENGTH = 6;
const MAX_MEMBERS = 15;

export default function JoinGroup() {
  const [code, setCode] = useState('');
  const [preview, setPreview] = useState(null);
  const [lookupError, setLookupError] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState(null);

  function handleChangeCode(value) {
    const cleaned = value
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, CODE_LENGTH);
    setCode(cleaned);
    setJoinError(null);
  }

  useEffect(() => {
    if (code.length !== CODE_LENGTH) {
      setPreview(null);
      setLookupError(null);
      setLookingUp(false);
      return;
    }

    let cancelled = false;
    setLookingUp(true);
    setLookupError(null);

    lookupGroupByInviteCode(code)
      .then((result) => {
        if (cancelled) return;
        if (!result) {
          setPreview(null);
          setLookupError('No group with that invite code.');
        } else {
          setPreview(result);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setPreview(null);
        setLookupError(err?.message ?? 'Could not look up that code.');
      })
      .finally(() => {
        if (!cancelled) setLookingUp(false);
      });

    return () => {
      cancelled = true;
    };
  }, [code]);

  async function handleJoin() {
    if (!preview) return;
    setJoinError(null);
    setJoining(true);
    try {
      const group = await joinGroupByInviteCode(code);
      if (!group?.id) throw new Error('Join did not return a group.');
      router.replace(`/group/${group.id}`);
    } catch (err) {
      setJoinError(err?.message ?? 'Could not join the group. Please try again.');
    } finally {
      setJoining(false);
    }
  }

  function handleOpenGroup() {
    if (preview?.id) router.replace(`/group/${preview.id}`);
  }

  const isFull = preview ? preview.member_count >= MAX_MEMBERS : false;
  const isAlreadyMember = preview?.is_member === true;
  const canJoin = preview && !isFull && !isAlreadyMember;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Join a group</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character invite code your friend shared.
          </Text>

          <Text style={styles.label}>Invite code</Text>
          <TextInput
            value={code}
            onChangeText={handleChangeCode}
            placeholder="ABCDEF"
            placeholderTextColor={colors.textMuted}
            style={styles.codeInput}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={CODE_LENGTH}
            editable={!joining}
            returnKeyType="done"
          />

          {lookingUp && (
            <View style={styles.lookupRow}>
              <ActivityIndicator color={colors.accent} />
              <Text style={styles.lookupText}>Looking up group…</Text>
            </View>
          )}

          {lookupError && !lookingUp && (
            <Text style={styles.error}>{lookupError}</Text>
          )}

          {preview && !lookingUp && (
            <View style={styles.preview}>
              <Text style={styles.previewName}>{preview.name}</Text>
              <Text style={styles.previewCount}>
                {preview.member_count}/{MAX_MEMBERS} members
              </Text>

              {isAlreadyMember && (
                <Text style={styles.previewNote}>
                  You're already in this group.
                </Text>
              )}
              {isFull && !isAlreadyMember && (
                <Text style={styles.previewNoteDanger}>
                  This group is full.
                </Text>
              )}
            </View>
          )}

          {joinError && <Text style={styles.error}>{joinError}</Text>}

          {isAlreadyMember ? (
            <Pressable
              onPress={handleOpenGroup}
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.buttonText}>Open group</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleJoin}
              disabled={!canJoin || joining}
              style={({ pressed }) => [
                styles.button,
                (!canJoin || joining) && styles.buttonDisabled,
                pressed && canJoin && !joining && styles.buttonPressed,
              ]}
            >
              {joining ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.buttonText}>Join group</Text>
              )}
            </Pressable>
          )}
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
  codeInput: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.dark,
    marginTop: 6,
  },

  lookupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  lookupText: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 14,
  },

  preview: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 16,
  },
  previewName: { fontSize: 18, fontWeight: '700', color: colors.dark },
  previewCount: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },
  previewNote: {
    marginTop: 12,
    fontSize: 13,
    color: colors.textMuted,
  },
  previewNoteDanger: {
    marginTop: 12,
    fontSize: 13,
    color: colors.danger,
  },

  error: { color: colors.danger, fontSize: 13, marginTop: 16 },

  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: { backgroundColor: colors.textMuted, opacity: 0.6 },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '600' },
});
