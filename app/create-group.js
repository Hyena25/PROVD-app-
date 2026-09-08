import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../constants/theme';
import { createGroup } from '../api/groupApi';
import { Button, Card, Field, Pill, Screen, TopBar } from '../components/ui';

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
    const shareCode = () =>
      Share.share({
        message: `Join "${createdGroup.name}" on Provd — invite code ${createdGroup.invite_code}`,
      }).catch(() => {});

    return (
      <Screen>
        <View style={styles.container}>
          <Card tone="lime">
            <Pill tone="neutral">Group created</Pill>
            <Text style={styles.doneTitle}>{createdGroup.name}</Text>
            <Text style={styles.doneBody}>
              Share this code so your friends can join.
            </Text>
            <View style={styles.codeBox}>
              <Text style={styles.code}>{createdGroup.invite_code}</Text>
            </View>
          </Card>

          <Button title="Share invite" onPress={shareCode} style={styles.cta} />
          <Button
            title="Continue to group"
            variant="ghost"
            onPress={handleContinue}
            style={styles.ghost}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <TopBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Name your squad</Text>
          <Text style={styles.subtitle}>
            Something your friends will recognise.
          </Text>

          <Card style={styles.card}>
            <Field
              label="Group name"
              value={name}
              onChangeText={setName}
              placeholder="Sunday Squad"
              maxLength={MAX_NAME_LENGTH}
              editable={!submitting}
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              hint={`${name.length}/${MAX_NAME_LENGTH}`}
              error={error}
            />
            <Button
              title="Create group"
              onPress={handleSubmit}
              loading={submitting}
            />
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

  doneTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 27,
    letterSpacing: -0.8,
    color: colors.limeInk,
    marginTop: space.md,
  },
  doneBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.limeInk,
    opacity: 0.75,
    marginTop: space.xs,
  },
  codeBox: {
    marginTop: space.xl,
    paddingVertical: space.lg,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(38,49,10,0.1)',
    alignItems: 'center',
  },
  code: {
    fontFamily: fonts.sansBold,
    fontSize: 28,
    letterSpacing: 7,
    color: colors.limeInk,
  },

  cta: { marginTop: space.lg },
  ghost: { marginTop: space.sm },
});
