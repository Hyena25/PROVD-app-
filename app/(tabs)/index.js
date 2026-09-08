import { useCallback, useEffect, useState } from 'react';
import {
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
import { listMyGroups } from '../../api/groupApi';
import { listPendingVotesForUser } from '../../api/voteApi';
import { colors, fonts, gutter, radius, space, type } from '../../constants/theme';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  IconButton,
  Loading,
  Pill,
  Screen,
  SectionTitle,
  Stat,
} from '../../components/ui';

const ACTIVE_STATUSES = ['pending', 'active'];

function formatExpiresIn(expiresAt) {
  if (!expiresAt) return null;
  const now = dayjs();
  const exp = dayjs(expiresAt);
  if (!exp.isValid()) return null;
  const diffMs = exp.diff(now);
  if (diffMs <= 0) return 'Expired';
  const hours = Math.floor(diffMs / 3_600_000);
  const minutes = Math.floor((diffMs % 3_600_000) / 60_000);
  if (hours >= 1) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export default function Home() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeDare, setActiveDare] = useState(null);
  const [groups, setGroups] = useState([]);
  const [pendingVotes, setPendingVotes] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();
      if (authError) throw authError;
      if (!session?.user) {
        router.replace('/login');
        return;
      }
      const user = session.user;

      const [profileRes, dareRes, groupsRes, votesRes] = await Promise.all([
        supabase
          .from('users')
          .select('username, display_name, total_points, current_streak, arena_verified')
          .eq('id', user.id)
          .single(),
        supabase
          .from('dares')
          .select('id, title, difficulty, points_value, expires_at, status')
          .eq('target_user_id', user.id)
          .in('status', ACTIVE_STATUSES)
          .order('created_at', { ascending: false })
          .limit(1),
        listMyGroups(),
        listPendingVotesForUser().catch(() => []),
      ]);

      if (profileRes.error) throw profileRes.error;
      setProfile(profileRes.data);

      if (dareRes.error) throw dareRes.error;
      setActiveDare(dareRes.data?.[0] ?? null);

      setGroups(groupsRes ?? []);
      setPendingVotes(votesRes ?? []);
    } catch (err) {
      setError(err?.message ?? 'Could not load home.');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load();
      if (!cancelled) {
        setLoading(false);
        setCheckingAuth(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (checkingAuth) return;
      load();
    }, [checkingAuth, load])
  );

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} back={false} />;

  const greetName = profile?.display_name || profile?.username || 'there';
  const expiresLabel = formatExpiresIn(activeDare?.expires_at);
  const verified = !!profile?.arena_verified;
  const initial = (profile?.username ?? '?').slice(0, 1).toUpperCase();

  return (
    <Screen>
      <View style={styles.masthead}>
        <View style={styles.brandRow}>
          <View style={styles.mark}>
            <Text style={styles.markGlyph}>P</Text>
          </View>
          <Text style={styles.brand}>Provd</Text>
        </View>
        <View style={styles.mastheadActions}>
          <IconButton
            glyph="◎"
            badge={pendingVotes.length > 0}
            onPress={() =>
              pendingVotes.length
                ? router.push(`/vote/${pendingVotes[0].submission_id}`)
                : null
            }
          />
          <IconButton
            glyph={initial}
            tone="navy"
            onPress={() => router.push('/profile')}
          />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.accent}
          />
        }
      >
        <Text style={styles.greeting}>Hey {greetName} 👋</Text>

        {/* Hero: the one dare you owe. Lime when live so it's unmissable. */}
        {activeDare ? (
          <Card
            tone="lime"
            style={styles.hero}
            onPress={() => router.push(`/dare/${activeDare.id}`)}
          >
            <View style={styles.heroTop}>
              <Text style={styles.heroLabel}>Your dare</Text>
              {expiresLabel ? (
                <View style={styles.heroClock}>
                  <Text style={styles.heroClockText}>{expiresLabel}</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.heroTitle}>{activeDare.title}</Text>
            <View style={styles.heroStats}>
              <View>
                <Text style={styles.heroStatValue}>
                  {activeDare.points_value}
                </Text>
                <Text style={styles.heroStatLabel}>points</Text>
              </View>
              <View style={styles.heroDivider} />
              <View>
                <Text style={styles.heroStatValue}>
                  {activeDare.difficulty}
                </Text>
                <Text style={styles.heroStatLabel}>difficulty</Text>
              </View>
              <View style={styles.heroGo}>
                <Text style={styles.heroGoGlyph}>↗</Text>
              </View>
            </View>
          </Card>
        ) : (
          <Card style={styles.hero}>
            <Text style={[type.label, styles.cardLabel]}>Your dare</Text>
            <Text style={styles.emptyHero}>
              Nothing on your plate. Throw the first one.
            </Text>
          </Card>
        )}

        <View style={styles.statRow}>
          <Card style={styles.statCard}>
            <Stat value={profile?.total_points ?? 0} label="Points" />
          </Card>
          <Card style={styles.statCard}>
            <Stat value={profile?.current_streak ?? 0} label="Day streak" />
          </Card>
        </View>

        <Button
          title="Dare a friend"
          onPress={() =>
            router.push(
              groups.length
                ? `/create-dare?groupId=${groups[0].id}`
                : '/create-group'
            )
          }
          style={styles.cta}
        />

        <SectionTitle style={styles.section}>Arena</SectionTitle>
        <Card
          tone={verified ? 'white' : 'navy'}
          onPress={() => router.push(verified ? '/arena' : '/arena-verify')}
        >
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={[styles.rowTitle, !verified && styles.onDark]}>
                {verified ? 'Enter the Arena' : 'Unlock Arena'}
              </Text>
              <Text style={[styles.rowMeta, !verified && styles.onDarkMuted]}>
                {verified
                  ? 'Dares from strangers.'
                  : "Verify you're 18+ to play."}
              </Text>
            </View>
            {verified ? <Pill tone="success">Open</Pill> : <Pill tone="lime">18+</Pill>}
          </View>
        </Card>

      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  mark: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '12deg' }],
  },
  markGlyph: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: '#FFFFFF',
    transform: [{ rotate: '-12deg' }],
  },
  brand: {
    fontFamily: fonts.sansBold,
    fontSize: 19,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  mastheadActions: { flexDirection: 'row', gap: space.sm },

  scroll: { paddingHorizontal: gutter, paddingBottom: 120 },

  greeting: { ...type.display, marginBottom: space.lg },

  hero: { marginBottom: space.md },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.limeInk,
    opacity: 0.7,
  },
  heroClock: {
    backgroundColor: 'rgba(38,49,10,0.12)',
    paddingHorizontal: space.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  heroClockText: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.limeInk,
  },
  heroTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.7,
    color: colors.limeInk,
    marginTop: space.md,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    marginTop: space.xl,
  },
  heroStatValue: {
    fontFamily: fonts.sansBold,
    fontSize: 19,
    color: colors.limeInk,
    textTransform: 'capitalize',
  },
  heroStatLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.limeInk,
    opacity: 0.65,
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(38,49,10,0.18)',
  },
  heroGo: {
    marginLeft: 'auto',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroGoGlyph: { fontFamily: fonts.sansMedium, fontSize: 17, color: '#FFFFFF' },

  cardLabel: { marginBottom: space.sm },
  emptyHero: { ...type.body, fontSize: 16 },

  statRow: { flexDirection: 'row', gap: space.md },
  statCard: { flex: 1 },

  cta: { marginTop: space.lg },

  section: { marginTop: space.xxl },

  rowCard: { marginBottom: space.sm, paddingVertical: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  rowMeta: { ...type.small, marginTop: 2 },
  chevron: { fontSize: 20, color: colors.muted },

  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,0.6)' },

  groupActions: { flexDirection: 'row', gap: space.sm },
});
