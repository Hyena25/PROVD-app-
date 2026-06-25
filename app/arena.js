import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { colors, shadows } from '../constants/theme';
import { CATEGORIES, DIFFICULTY_TIERS } from '../api/dareApi';
import { listArenaDares, acceptArenaDare } from '../api/arenaApi';

function categoryLabelFor(key) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function difficultyTierFor(key) {
  return DIFFICULTY_TIERS.find((t) => t.key === key) ?? null;
}

function formatWindow(expiresAt) {
  if (!expiresAt) return null;
  const diffMs = dayjs(expiresAt).diff(dayjs());
  if (diffMs <= 0) return 'Expired';
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours >= 1) return `${hours}h left`;
  return `${Math.max(1, Math.floor(diffMs / 60_000))}m left`;
}

export default function Arena() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [verified, setVerified] = useState(false);
  const [dares, setDares] = useState([]);
  const [acceptingId, setAcceptingId] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error('You need to be signed in to play Arena.');

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('arena_verified')
        .eq('id', user.id)
        .single();
      if (profileError) throw profileError;

      const isVerified = !!profile?.arena_verified;
      setVerified(isVerified);

      if (isVerified) {
        setDares(await listArenaDares());
      }
    } catch (err) {
      setError(err?.message ?? 'Could not load Arena.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleAccept(dare) {
    if (acceptingId) return;
    setAcceptingId(dare.id);
    try {
      await acceptArenaDare(dare.id);
      setDares((prev) => prev.filter((d) => d.id !== dare.id));
      Alert.alert('Dare accepted', `"${dare.title}" is now in play. Good luck.`);
    } catch (err) {
      Alert.alert('Could not accept', err?.message ?? 'Please try again.');
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerLink}>Back</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          verified ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          ) : undefined
        }
      >
        <Text style={styles.title}>Arena</Text>
        <Text style={styles.subtitle}>
          Open dares from strangers. Accept one and the clock starts.
        </Text>

        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !verified ? (
          <View style={styles.lockedCard}>
            <Text style={styles.lockedTitle}>Arena is 18+</Text>
            <Text style={styles.lockedBody}>
              Verify your age to unlock dares from strangers. You can keep
              playing Friends dares either way.
            </Text>
            <Pressable
              onPress={() => router.push('/arena-verify')}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.primaryButtonText}>Verify 18+</Text>
            </Pressable>
          </View>
        ) : dares.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>
              No open dares right now. Pull to refresh and check back soon.
            </Text>
          </View>
        ) : (
          dares.map((dare) => {
            const tier = difficultyTierFor(dare.difficulty);
            const windowLabel = formatWindow(dare.expires_at);
            const accepting = acceptingId === dare.id;
            return (
              <View key={dare.id} style={styles.dareCard}>
                <View style={styles.dareTagsRow}>
                  <View style={styles.categoryTag}>
                    <Text style={styles.categoryTagText}>
                      {categoryLabelFor(dare.category)}
                    </Text>
                  </View>
                  {tier ? (
                    <View
                      style={[styles.difficultyTag, { backgroundColor: tier.color }]}
                    >
                      <Text style={styles.difficultyTagText}>
                        {tier.label} • {dare.points_value ?? tier.points} pts
                      </Text>
                    </View>
                  ) : null}
                </View>

                <Text style={styles.dareTitle}>{dare.title}</Text>
                {dare.description ? (
                  <Text style={styles.dareDescription}>{dare.description}</Text>
                ) : null}

                <View style={styles.dareMetaRow}>
                  <Text style={styles.dareMetaText}>
                    from @{dare.sender?.username ?? 'stranger'}
                  </Text>
                  {windowLabel ? (
                    <Text style={styles.dareMetaText}>{windowLabel}</Text>
                  ) : null}
                </View>

                <Pressable
                  onPress={() => handleAccept(dare)}
                  disabled={!!acceptingId}
                  style={({ pressed }) => [
                    styles.acceptButton,
                    pressed && !acceptingId && styles.pressed,
                    !!acceptingId && styles.buttonDimmed,
                  ]}
                >
                  {accepting ? (
                    <ActivityIndicator color={colors.background} />
                  ) : (
                    <Text style={styles.acceptButtonText}>Accept dare</Text>
                  )}
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },

  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },

  title: { fontSize: 32, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 20,
  },
  error: { color: colors.danger, fontSize: 14, marginTop: 8 },

  lockedCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 20,
  },
  lockedTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  lockedBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
    marginBottom: 16,
  },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
  },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },

  dareCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    ...shadows.card,
  },
  dareTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
    marginBottom: 10,
  },
  categoryTag: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  categoryTagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  difficultyTag: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  difficultyTagText: { color: colors.background, fontSize: 13, fontWeight: '700' },

  dareTitle: { fontSize: 18, fontWeight: '700', color: colors.dark },
  dareDescription: {
    marginTop: 6,
    fontSize: 14,
    color: colors.textMuted,
    lineHeight: 20,
  },
  dareMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  dareMetaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  acceptButton: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadows.button,
  },
  acceptButtonText: { color: colors.background, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadows.button,
  },
  primaryButtonText: { color: colors.background, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },

  pressed: { opacity: 0.85 },
  buttonDimmed: { opacity: 0.6 },
});
