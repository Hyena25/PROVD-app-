import { useRef, useState } from 'react';
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
import { verifyAge } from '../api/arenaApi';
import { colors, shadows } from '../constants/theme';

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
      router.back();
    } catch (err) {
      setError(err?.message ?? 'Could not verify. Please try again.');
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
          <Text style={styles.title}>Unlock Arena</Text>
          <Text style={styles.subtitle}>
            Arena mode is for users 18 and over. Confirm your date of birth to
            unlock dares from strangers.
          </Text>

          <Text style={styles.label}>Date of birth</Text>
          <View style={styles.dobRow}>
            <TextInput
              value={month}
              onChangeText={(t) => {
                const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                setMonth(v);
                if (v.length === 2) dayRef.current?.focus();
              }}
              keyboardType="number-pad"
              placeholder="MM"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.dobInput]}
              editable={!submitting}
              maxLength={2}
            />
            <TextInput
              ref={dayRef}
              value={day}
              onChangeText={(t) => {
                const v = t.replace(/[^0-9]/g, '').slice(0, 2);
                setDay(v);
                if (v.length === 2) yearRef.current?.focus();
              }}
              keyboardType="number-pad"
              placeholder="DD"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.dobInput]}
              editable={!submitting}
              maxLength={2}
            />
            <TextInput
              ref={yearRef}
              value={year}
              onChangeText={(t) => setYear(t.replace(/[^0-9]/g, '').slice(0, 4))}
              keyboardType="number-pad"
              placeholder="YYYY"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.dobInputYear]}
              editable={!submitting}
              maxLength={4}
            />
          </View>

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
              <Text style={styles.buttonText}>Verify</Text>
            )}
          </Pressable>

          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.cancel}>
            <Text style={styles.cancelText}>Not now</Text>
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
  title: { fontSize: 32, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 8,
    marginBottom: 24,
    lineHeight: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 8,
  },
  dobRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
    textAlign: 'center',
  },
  dobInput: { width: 72 },
  dobInputYear: { width: 100 },
  error: { color: colors.danger, fontSize: 13, marginTop: 16 },
  button: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { color: colors.background, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },
  cancel: { marginTop: 16, alignItems: 'center' },
  cancelText: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
});
