import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../lib/supabase';
import { listMyGroups } from '../api/groupApi';
import { listPendingVotesForUser } from '../api/voteApi';
import { colors, shadows } from '../constants/theme';

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
          <Pressable onPress={load} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const greetName = profile?.display_name || profile?.username || 'there';
  const expiresLabel = formatExpiresIn(activeDare?.expires_at);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={styles.brand}>Provd</Text>
          <Pressable onPress={() => router.push('/profile')} hitSlop={8}>
            <Text style={styles.profileLink}>Profile</Text>
          </Pressable>
        </View>

        <Text style={styles.greeting}>Hey, {greetName}.</Text>

        <View style={styles.statsRow}>
          <Stat label="Points" value={profile?.total_points ?? 0} />
          <Stat label="Streak" value={profile?.current_streak ?? 0} />
        </View>

        <Text style={styles.sectionTitle}>Your dare</Text>
        {activeDare ? (
          <Pressable
            onPress={() => router.push(`/dare/${activeDare.id}`)}
            style={({ pressed }) => [styles.dareCard, pressed && styles.pressed]}
          >
            <Text style={styles.dareTitle} numberOfLines={2}>
              {activeDare.title}
            </Text>
            <View style={styles.dareMeta}>
              <Text style={styles.dareMetaText}>
                {activeDare.difficulty.toUpperCase()} · {activeDare.points_value} pts
              </Text>
              {expiresLabel ? <Text style={styles.dareMetaText}>{expiresLabel}</Text> : null}
            </View>
          </Pressable>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>No active dare. Wait for a friend, or dare one yourself.</Text>
          </View>
        )}

        <Pressable
          onPress={() =>
            router.push(
              groups.length
                ? `/create-dare?groupId=${groups[0].id}`
                : '/create-group'
            )
          }
          style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
        >
          <Text style={styles.primaryButtonText}>Dare a friend</Text>
        </Pressable>

        {pendingVotes.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              Votes to cast ({pendingVotes.length})
            </Text>
            {pendingVotes.map((v) => (
              <Pressable
                key={v.submission_id}
                onPress={() => router.push(`/vote/${v.submission_id}`)}
                style={({ pressed }) => [styles.voteRow, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <Text style={styles.voteTitle} numberOfLines={1}>
                    {v.dare_title}
                  </Text>
                  <Text style={styles.voteMeta}>
                    @{v.submitter_username} ·{' '}
                    {v.media_type === 'video' ? 'Video' : 'Photo'} proof
                  </Text>
                </View>
                <Text style={styles.voteCta}>Vote</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Arena</Text>
        <Pressable
          onPress={() =>
            router.push(profile?.arena_verified ? '/arena' : '/arena-verify')
          }
          style={({ pressed }) => [styles.arenaCard, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text style={styles.arenaTitle}>
              {profile?.arena_verified ? 'Enter the Arena' : 'Unlock Arena'}
            </Text>
            <Text style={styles.arenaHint}>
              {profile?.arena_verified
                ? 'Take on dares from strangers.'
                : "Verify you're 18+ to play with strangers."}
            </Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your groups</Text>
          <View style={styles.sectionActions}>
            <Pressable onPress={() => router.push('/join-group')} hitSlop={8}>
              <Text style={styles.linkAction}>Join</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/create-group')} hitSlop={8}>
              <Text style={styles.linkAction}>Create</Text>
            </Pressable>
          </View>
        </View>

        {groups.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.empty}>
              No groups yet. Join one with an invite code, or create your own.
            </Text>
          </View>
        ) : (
          groups.map((g) => (
            <Pressable
              key={g.id}
              onPress={() => router.push(`/group/${g.id}`)}
              style={({ pressed }) => [styles.groupRow, pressed && styles.pressed]}
            >
              <View style={styles.flex}>
                <Text style={styles.groupName} numberOfLines={1}>
                  {g.name}
                </Text>
                <Text style={styles.groupMeta}>{g.member_count} members</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  flex: { flex: 1 },

  error: { color: colors.danger, fontSize: 14, textAlign: 'center' },
  retry: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  retryText: { color: colors.dark, fontSize: 14, fontWeight: '600' },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brand: { fontSize: 26, fontWeight: '800', color: colors.accent, letterSpacing: -0.5 },
  profileLink: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  greeting: { fontSize: 30, fontWeight: '800', color: colors.dark, marginBottom: 20, letterSpacing: -0.5 },

  statsRow: { flexDirection: 'row', marginHorizontal: -6, marginBottom: 8 },
  stat: { flex: 1, paddingHorizontal: 6 },
  statValue: {
    fontSize: 22,
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

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.dark, marginTop: 24, marginBottom: 8 },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 8,
  },
  sectionActions: { flexDirection: 'row', gap: 16, marginBottom: 2 },
  linkAction: { color: colors.accent, fontSize: 14, fontWeight: '600' },

  dareCard: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 18,
    ...shadows.card,
  },
  dareTitle: { fontSize: 17, fontWeight: '700', color: colors.dark },
  dareMeta: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dareMetaText: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },

  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 18,
  },
  empty: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },

  primaryButton: {
    marginTop: 16,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  primaryButtonText: { color: colors.background, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  groupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    ...shadows.card,
  },
  groupName: { fontSize: 15, fontWeight: '600', color: colors.dark },
  groupMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  chevron: { fontSize: 24, color: colors.textMuted, marginLeft: 12 },

  voteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    ...shadows.card,
  },
  voteTitle: { fontSize: 15, fontWeight: '600', color: colors.dark },
  voteMeta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  voteCta: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
    backgroundColor: colors.accent,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
    overflow: 'hidden',
    marginLeft: 12,
  },

  arenaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  arenaTitle: { fontSize: 15, fontWeight: '700', color: colors.dark },
  arenaHint: { fontSize: 13, color: colors.textMuted, marginTop: 2 },

  pressed: { opacity: 0.85 },
});
