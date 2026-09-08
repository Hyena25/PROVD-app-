import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { colors, fonts, gutter, radius, space, type } from '../constants/theme';
import {
  lookupGroupByInviteCode,
  joinGroupByInviteCode,
} from '../api/groupApi';
import { Button, Card, Pill, Screen, TopBar } from '../components/ui';

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
    <Screen>
      <TopBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Got a code?</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character invite code your friend shared.
          </Text>

          <Card style={styles.card}>
            <TextInput
              value={code}
              onChangeText={handleChangeCode}
              placeholder="ABCDEF"
              placeholderTextColor={colors.line}
              style={[
                styles.codeInput,
                code.length > 0 && styles.codeInputFilled,
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              autoComplete="off"
              maxLength={CODE_LENGTH}
              editable={!joining}
              returnKeyType="done"
            />

            <View style={styles.statusSlot}>
              {lookingUp ? (
                <View style={styles.lookupRow}>
                  <ActivityIndicator color={colors.accent} size="small" />
                  <Text style={styles.lookupText}>Looking up group…</Text>
                </View>
              ) : lookupError ? (
                <Text style={styles.error}>{lookupError}</Text>
              ) : preview ? (
                <View style={styles.previewRow}>
                  <View style={styles.previewMain}>
                    <Text style={styles.previewName}>{preview.name}</Text>
                    <Text style={styles.previewCount}>
                      {preview.member_count}/{MAX_MEMBERS} members
                    </Text>
                  </View>
                  {isAlreadyMember ? (
                    <Pill tone="success">Joined</Pill>
                  ) : isFull ? (
                    <Pill tone="danger">Full</Pill>
                  ) : (
                    <Pill tone="lime">Open</Pill>
                  )}
                </View>
              ) : null}
            </View>

            {joinError ? <Text style={styles.error}>{joinError}</Text> : null}

            {isAlreadyMember ? (
              <Button title="Open group" onPress={handleOpenGroup} />
            ) : (
              <Button
                title="Join group"
                onPress={handleJoin}
                loading={joining}
                disabled={!canJoin}
              />
            )}
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: gutter, justifyContent: 'center' },

  title: { ...type.display, fontSize: 32, lineHeight: 38 },
  subtitle: { ...type.bodyMuted, marginTop: space.sm },
  card: { marginTop: space.xl },

  codeInput: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.lg,
    paddingVertical: space.xl,
    fontSize: 27,
    fontFamily: fonts.sansBold,
    letterSpacing: 9,
    textAlign: 'center',
    color: colors.ink,
  },
  codeInputFilled: { borderColor: colors.accent },

  statusSlot: {
    minHeight: 58,
    justifyContent: 'center',
    marginVertical: space.md,
  },
  lookupRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  lookupText: { ...type.small },

  previewRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  previewMain: { flex: 1 },
  previewName: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },
  previewCount: { ...type.small, marginTop: 1 },

  error: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
    marginBottom: space.md,
  },
});
