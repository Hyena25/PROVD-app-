import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../../constants/theme';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Loading,
  Pill,
  Screen,
  SectionTitle,
  Stat,
  TopBar,
} from '../../components/ui';

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [crowns, setCrowns] = useState([]);
  const [completedDares, setCompletedDares] = useState([]);
  const [totalAssigned, setTotalAssigned] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('You need to be signed in to view your profile.');

        const { data: profileRow, error: profileError } = await supabase
          .from('users')
          .select(
            'username, display_name, current_streak, total_points, arena_verified'
          )
          .eq('id', user.id)
          .single();
        if (profileError) throw profileError;
        if (cancelled) return;
        setProfile(profileRow);

        const { data: crownRows, error: crownError } = await supabase
          .from('user_crowns')
          .select('id, label, period_start, period_end, awarded_at')
          .eq('user_id', user.id)
          .order('awarded_at', { ascending: false });
        if (crownError) throw crownError;
        if (cancelled) return;
        setCrowns(crownRows ?? []);

        // Dares table may not exist yet — handle gracefully.
        const [completedRes, assignedRes] = await Promise.all([
          supabase
            .from('dares')
            .select('id, title, completed_at')
            .eq('recipient_id', user.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false }),
          supabase
            .from('dares')
            .select('id', { count: 'exact', head: true })
            .eq('recipient_id', user.id),
        ]);
        if (cancelled) return;
        if (!completedRes.error && !assignedRes.error) {
          setCompletedDares(completedRes.data ?? []);
          setTotalAssigned(assignedRes.count ?? 0);
        } else {
          setCompletedDares([]);
          setTotalAssigned(0);
        }
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Could not load your profile.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} />;

  const totalCompleted = completedDares.length;
  const completionRate =
    totalAssigned > 0 ? Math.round((totalCompleted / totalAssigned) * 100) : 0;

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <Screen>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card tone="navy" style={styles.headCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarGlyph}>
              {(profile.username ?? '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.display_name ? (
            <Text style={styles.displayName}>{profile.display_name}</Text>
          ) : null}

          <View style={styles.headStats}>
            <Stat
              value={profile.total_points ?? 0}
              label="Points"
              tone="onDark"
            />
            <View style={styles.vDivider} />
            <Stat
              value={profile.current_streak ?? 0}
              label="Streak"
              tone="onDark"
            />
            <View style={styles.vDivider} />
            <Stat value={totalCompleted} label="Done" tone="onDark" />
          </View>
        </Card>

        <Card style={styles.card}>
          <View style={styles.meterTop}>
            <Text style={type.label}>Completion rate</Text>
            <Text style={styles.meterValue}>{completionRate}%</Text>
          </View>
          <View style={styles.meterTrack}>
            <View style={[styles.meterFill, { width: `${completionRate}%` }]} />
          </View>
          <Text style={styles.meterHint}>
            {totalCompleted} of {totalAssigned} dares completed
          </Text>
        </Card>

        <SectionTitle style={styles.section}>Arena</SectionTitle>
        <Card
          onPress={() =>
            router.push(profile.arena_verified ? '/arena' : '/arena-verify')
          }
        >
          <View style={styles.row}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle}>
                {profile.arena_verified ? 'Enter the Arena' : 'Unlock Arena'}
              </Text>
              <Text style={styles.rowMeta}>
                {profile.arena_verified
                  ? 'Dares from strangers.'
                  : "Verify you're 18+ to play."}
              </Text>
            </View>
            {profile.arena_verified ? (
              <Pill tone="success">Verified</Pill>
            ) : (
              <Pill tone="lime">18+</Pill>
            )}
          </View>
        </Card>

        <SectionTitle style={styles.section}>Crowns</SectionTitle>
        {crowns.length === 0 ? (
          <Card>
            <Empty>No crowns yet — keep going.</Empty>
          </Card>
        ) : (
          <View style={styles.crownWrap}>
            {crowns.map((c) => (
              <Card key={c.id} tone="lime" style={styles.crown}>
                <Text style={styles.crownLabel}>{c.label}</Text>
                <Text style={styles.crownDate}>
                  {dayjs(c.awarded_at).format('MMM YYYY')}
                </Text>
              </Card>
            ))}
          </View>
        )}

        <SectionTitle style={styles.section}>Past dares</SectionTitle>
        {completedDares.length === 0 ? (
          <Card>
            <Empty>No completed dares yet.</Empty>
          </Card>
        ) : (
          <Card>
            {completedDares.map((d, i) => (
              <View
                key={d.id}
                style={[styles.pastRow, i > 0 && styles.pastDivided]}
              >
                <Text style={styles.pastTitle} numberOfLines={1}>
                  {d.title}
                </Text>
                <Text style={styles.pastDate}>
                  {d.completed_at ? dayjs(d.completed_at).format('MMM D') : '—'}
                </Text>
              </View>
            ))}
          </Card>
        )}

        <Button
          title="Sign out"
          variant="secondary"
          onPress={handleSignOut}
          style={styles.signOut}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: gutter, paddingBottom: 120 },

  headCard: { alignItems: 'center', paddingVertical: space.xxl },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarGlyph: {
    fontFamily: fonts.sansBold,
    fontSize: 25,
    color: colors.limeInk,
  },
  username: {
    fontFamily: fonts.sansBold,
    fontSize: 23,
    letterSpacing: -0.6,
    color: '#FFFFFF',
    marginTop: space.md,
  },
  displayName: {
    fontFamily: fonts.sans,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  headStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xl,
    marginTop: space.xl,
  },
  vDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.16)' },

  card: { marginTop: space.md },
  section: { marginTop: space.xxl },

  meterTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meterValue: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  meterTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surface,
    marginTop: space.md,
    overflow: 'hidden',
  },
  meterFill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  meterHint: { ...type.small, marginTop: space.sm },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowMain: { flex: 1 },
  rowTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  rowMeta: { ...type.small, marginTop: 2 },

  crownWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  crown: { paddingVertical: space.md, paddingHorizontal: space.lg },
  crownLabel: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.limeInk,
  },
  crownDate: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.limeInk,
    opacity: 0.7,
    marginTop: 2,
  },

  pastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
  },
  pastDivided: { borderTopWidth: 1, borderTopColor: colors.line },
  pastTitle: {
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 14,
    color: colors.ink,
  },
  pastDate: { ...type.small, marginLeft: space.md },

  signOut: { marginTop: space.xxl },
});
