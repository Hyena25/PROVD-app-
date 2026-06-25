import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
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
import BackBar from '../components/BackBar';

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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const totalCompleted = completedDares.length;
  const completionRate =
    totalAssigned > 0
      ? Math.round((totalCompleted / totalAssigned) * 100)
      : null;

  return (
    <SafeAreaView style={styles.safe}>
      <BackBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.username}>@{profile.username}</Text>
          {profile.display_name ? (
            <Text style={styles.displayName}>{profile.display_name}</Text>
          ) : null}
        </View>

        <View style={styles.statsGrid}>
          <Stat label="Streak" value={profile.current_streak ?? 0} />
          <Stat label="Points" value={profile.total_points ?? 0} />
          <Stat label="Completed" value={totalCompleted} />
          <Stat
            label="Completion"
            value={completionRate == null ? '—' : `${completionRate}%`}
          />
        </View>

        <Text style={styles.sectionTitle}>Arena</Text>
        {profile.arena_verified ? (
          <Pressable
            onPress={() => router.push('/arena')}
            style={({ pressed }) => [styles.arenaCta, pressed && styles.pressed]}
          >
            <Text style={styles.arenaVerified}>Verified · 18+</Text>
            <Text style={styles.arenaCtaHint}>Enter the Arena — dares from strangers.</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/arena-verify')}
            style={({ pressed }) => [styles.arenaCta, pressed && styles.pressed]}
          >
            <Text style={styles.arenaCtaText}>Unlock Arena</Text>
            <Text style={styles.arenaCtaHint}>Verify you're 18+ to play with strangers.</Text>
          </Pressable>
        )}

        <Text style={styles.sectionTitle}>Crowns</Text>
        {crowns.length === 0 ? (
          <Text style={styles.empty}>No crowns yet — keep going.</Text>
        ) : (
          <View style={styles.crownGrid}>
            {crowns.map((c) => (
              <View key={c.id} style={styles.crown}>
                <Text style={styles.crownLabel}>{c.label}</Text>
                <Text style={styles.crownDate}>
                  {dayjs(c.awarded_at).format('MMM YYYY')}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.sectionTitle}>Past Dares</Text>
        {completedDares.length === 0 ? (
          <Text style={styles.empty}>No completed dares yet.</Text>
        ) : (
          completedDares.map((d) => (
            <View key={d.id} style={styles.dareRow}>
              <Text style={styles.dareTitle} numberOfLines={1}>
                {d.title}
              </Text>
              <Text style={styles.dareDate}>
                {d.completed_at
                  ? dayjs(d.completed_at).format('MMM D, YYYY')
                  : '—'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: 24, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },

  header: { marginBottom: 24 },
  username: { fontSize: 32, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  displayName: { marginTop: 4, fontSize: 16, color: colors.textMuted },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
    marginBottom: 16,
  },
  stat: {
    width: '50%',
    paddingHorizontal: 6,
    paddingVertical: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.dark,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 14,
    overflow: 'hidden',
    ...shadows.card,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 6,
    paddingHorizontal: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 16,
    marginBottom: 8,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 8,
  },

  crownGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  crown: {
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    margin: 4,
    ...shadows.card,
  },
  crownLabel: { color: colors.dark, fontSize: 14, fontWeight: '600' },
  crownDate: { color: colors.textMuted, fontSize: 12, marginTop: 2 },

  dareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surface,
  },
  dareTitle: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    marginRight: 12,
  },
  dareDate: {
    color: colors.textMuted,
    fontSize: 13,
  },

  arenaCta: {
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    ...shadows.card,
  },
  arenaCtaText: { color: colors.dark, fontSize: 15, fontWeight: '700' },
  arenaCtaHint: { color: colors.textMuted, fontSize: 13, marginTop: 4 },
  arenaRow: { paddingVertical: 4 },
  arenaVerified: { color: colors.success, fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.85 },
});
