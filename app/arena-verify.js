import { useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { verifyAge } from '../api/arenaApi';
import { colors, fonts, gutter, radius, space, type } from '../constants/theme';
import { Button, Card, Pill, Screen, TopBar } from '../components/ui';

export default function ArenaVerify() {
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const dayRef = useRef(null);
  const yearRef = useRef(null);

  function parseDob() {
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (!Number.isInteger(m) || !Number.isInteger(d) || !Number.isInteger(y)) {
      return null;
    }
    if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900) return null;
    // Round-trip through Date to catch invalid combos (Feb 30, Apr 31, etc.).
    const dt = new Date(y, m - 1, d);
    if (
      dt.getFullYear() !== y ||
      dt.getMonth() !== m - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    if (dt.getTime() > Date.now()) return null;
    return `${y.toString().padStart(4, '0')}-${m
      .toString()
      .padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
  }

  async function handleSubmit() {
    setError(null);
    const dob = parseDob();
    if (!dob) {
      setError('Enter a valid date of birth.');
      return;
    }

    setSubmitting(true);
    try {
      const ok = await verifyAge(dob);
      if (!ok) {
        setError('Arena is 18+. You can keep playing Friends dares.');
        return;
      }
      // Land in the unlocked Arena rather than going back to whatever gate
      // sent us here.
      router.replace('/arena');
    } catch (err) {
      setError(err?.message ?? 'Could not verify. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const boxProps = {
    keyboardType: 'number-pad',
    placeholderTextColor: colors.muted,
    editable: !submitting,
  };

  return (
    <Screen>
      <TopBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Card tone="navy" style={styles.intro}>
            <Pill tone="lime">18+ only</Pill>
            <Text style={styles.title}>
              Prove you{'\u2019'}re old enough
            </Text>
            <Text style={styles.subtitle}>
              Arena pairs you with strangers. We only check your age — the date
              isn{'\u2019'}t shown on your profile.
            </Text>
          </Card>

          <Card style={styles.card}>
            <Text style={[type.label, styles.dobLabel]}>Date of birth</Text>
            <View style={styles.dobRow}>
              <TextInput
                value={month}
                onChangeText={(t) => {
                  const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                  setMonth(v);
                  if (v.length === 2) dayRef.current?.focus();
                }}
                placeholder="MM"
                maxLength={2}
                style={[styles.box, month && styles.boxFilled]}
                {...boxProps}
              />
              <Text style={styles.slash}>/</Text>
              <TextInput
                ref={dayRef}
                value={day}
                onChangeText={(t) => {
                  const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                  setDay(v);
                  if (v.length === 2) yearRef.current?.focus();
                }}
                placeholder="DD"
                maxLength={2}
                style={[styles.box, day && styles.boxFilled]}
                {...boxProps}
              />
              <Text style={styles.slash}>/</Text>
              <TextInput
                ref={yearRef}
                value={year}
                onChangeText={(t) =>
                  setYear(t.replace(/[^0-9]/g, '').slice(0, 4))
                }
                placeholder="YYYY"
                maxLength={4}
                style={[styles.box, styles.boxYear, year && styles.boxFilled]}
                {...boxProps}
              />
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Button
              title="Verify age"
              onPress={handleSubmit}
              loading={submitting}
              style={styles.cta}
            />
          </Card>

          <Button
            title="Not now"
            variant="ghost"
            onPress={() => router.back()}
            style={styles.ghost}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, paddingHorizontal: gutter, justifyContent: 'center' },

  intro: {},
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
    color: '#FFFFFF',
    marginTop: space.md,
  },
  subtitle: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.65)',
    marginTop: space.sm,
  },

  card: { marginTop: space.md },
  dobLabel: { marginBottom: space.md },
  dobRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  box: {
    width: 64,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
    borderRadius: radius.md,
    paddingVertical: 14,
    fontSize: 17,
    fontFamily: fonts.sansBold,
    color: colors.ink,
    textAlign: 'center',
  },
  boxYear: { width: 90 },
  boxFilled: { borderColor: colors.accent },
  slash: { fontFamily: fonts.sans, fontSize: 17, color: colors.line },

  error: {
    marginTop: space.md,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
  },
  cta: { marginTop: space.xl },
  ghost: { marginTop: space.md },
});
