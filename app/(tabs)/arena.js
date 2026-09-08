import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../../constants/theme';
import {
  Button,
  Card,
  Empty,
  Loading,
  Pill,
  Screen,
} from '../../components/ui';
import { CATEGORIES, DIFFICULTY_TIERS } from '../../api/dareApi';
import { listArenaDares, acceptArenaDare } from '../../api/arenaApi';

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

  // Re-read on focus, not just on mount: coming back from /arena-verify has to
  // pick up the newly-set arena_verified flag or the gate stays up forever.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await load();
        if (!cancelled) setLoading(false);
      })();
      return () => {
        cancelled = true;
      };
    }, [load])
  );

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

  if (loading) return <Loading />;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
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
          Open dares from people you don{'\u2019'}t know. Accept one and the
          clock starts.
        </Text>

        {error ? (
          <Card style={styles.top}>
            <Text style={styles.error}>{error}</Text>
          </Card>
        ) : !verified ? (
          <Card tone="navy" style={styles.top}>
            <Pill tone="lime">18+ only</Pill>
            <Text style={styles.lockedTitle}>Arena is age-gated</Text>
            <Text style={styles.lockedBody}>
              Verify your age to unlock dares from strangers. Friends dares keep
              working either way.
            </Text>
            <Button
              title="Verify 18+"
              onPress={() => router.push('/arena-verify')}
              style={styles.cta}
            />
          </Card>
        ) : dares.length === 0 ? (
          <Card style={styles.top}>
            <Empty>
              No open dares right now. Pull to refresh and check back soon.
            </Empty>
          </Card>
        ) : (
          dares.map((dare, i) => {
            const tier = difficultyTierFor(dare.difficulty);
            const windowLabel = formatWindow(dare.expires_at);
            const accepting = acceptingId === dare.id;
            return (
              <Card
                key={dare.id}
                tone={i === 0 ? 'lime' : 'white'}
                style={styles.item}
              >
                <View style={styles.itemTop}>
                  <Pill tone={i === 0 ? 'neutral' : 'neutral'}>
                    {categoryLabelFor(dare.category)}
                  </Pill>
                  {windowLabel ? (
                    <Text
                      style={[styles.window, i === 0 && styles.onLimeMuted]}
                    >
                      {windowLabel}
                    </Text>
                  ) : null}
                </View>

                <Text style={[styles.itemTitle, i === 0 && styles.onLime]}>
                  {dare.title}
                </Text>
                {dare.description ? (
                  <Text
                    style={[styles.itemBody, i === 0 && styles.onLimeMuted]}
                  >
                    {dare.description}
                  </Text>
                ) : null}

                <View style={styles.itemFoot}>
                  <View>
                    <Text
                      style={[
                        styles.pointsValue,
                        i === 0 && styles.onLime,
                        i !== 0 && {
                          color: colors[dare.difficulty] ?? colors.ink,
                        },
                      ]}
                    >
                      {dare.points_value} pts
                    </Text>
                    <Text
                      style={[styles.from, i === 0 && styles.onLimeMuted]}
                    >
                      {tier ? `${tier.label} · ` : ''}@
                      {dare.sender?.username ?? 'someone'}
                    </Text>
                  </View>
                  <Button
                    title={accepting ? '' : 'Accept'}
                    variant={i === 0 ? 'dark' : 'primary'}
                    onPress={() => handleAccept(dare)}
                    loading={accepting}
                    disabled={!!acceptingId && !accepting}
                    style={styles.accept}
                  />
                </View>
              </Card>
            );
          })
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: gutter, paddingTop: space.sm, paddingBottom: 120 },

  title: { ...type.display },
  subtitle: { ...type.bodyMuted, marginTop: space.sm, marginBottom: space.lg },

  top: {},
  error: { fontFamily: fonts.sans, fontSize: 14, color: colors.danger },

  lockedTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 21,
    letterSpacing: -0.5,
    color: '#FFFFFF',
    marginTop: space.md,
  },
  lockedBody: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.65)',
    marginTop: space.sm,
  },
  cta: { marginTop: space.xl },

  item: { marginBottom: space.md },
  itemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  window: { fontFamily: fonts.sansMedium, fontSize: 12, color: colors.muted },

  itemTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.ink,
    marginTop: space.md,
  },
  itemBody: { ...type.body, marginTop: space.sm },

  itemFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: space.xl,
  },
  pointsValue: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.ink,
  },
  from: { ...type.small, marginTop: 1 },
  accept: { paddingHorizontal: space.xxl, paddingVertical: 12, minWidth: 110 },

  onLime: { color: colors.limeInk },
  onLimeMuted: { color: colors.limeInk, opacity: 0.7 },
});
