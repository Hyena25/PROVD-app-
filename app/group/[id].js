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
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { colors, shadows } from '../../constants/theme';
import BackBar from '../../components/BackBar';

export default function GroupDetail() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [meId, setMeId] = useState(null);

  useEffect(() => {
    if (!id) return;
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
        if (!user) throw new Error('You must be signed in to view this group.');
        if (cancelled) return;
        setMeId(user.id);

        const { data, error: rpcError } = await supabase.rpc(
          'get_group_overview',
          { p_group_id: id }
        );
        if (rpcError) {
          const m = rpcError.message ?? '';
          if (m.includes('not_a_member')) {
            throw new Error('You are not a member of this group.');
          }
          if (m.includes('group_not_found')) {
            throw new Error('That group does not exist.');
          }
          throw rpcError;
        }
        if (cancelled) return;
        setOverview(data);
      } catch (err) {
        if (!cancelled) setError(err?.message ?? 'Could not load this group.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !overview) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Group not available.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const members = overview.members ?? [];
  const myIndex = meId ? members.findIndex((m) => m.user_id === meId) : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const daysRemaining = dayjs()
    .endOf('month')
    .diff(dayjs().startOf('day'), 'day');

  return (
    <SafeAreaView style={styles.safe}>
      <BackBar />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.groupName}>{overview.name}</Text>

        <View style={styles.pillRow}>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Season ends in</Text>
            <Text style={styles.pillValue}>
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'}
            </Text>
          </View>
          <View style={styles.pill}>
            <Text style={styles.pillLabel}>Your rank</Text>
            <Text style={styles.pillValue}>
              {myRank ? `#${myRank} of ${members.length}` : '—'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => router.push(`/create-dare?groupId=${id}`)}
          style={({ pressed }) => [
            styles.cta,
            pressed && styles.ctaPressed,
          ]}
        >
          <Text style={styles.ctaText}>Send a new dare</Text>
        </Pressable>

        <Text style={styles.sectionTitle}>Members</Text>
        {members.length === 0 ? (
          <Text style={styles.empty}>No members yet.</Text>
        ) : (
          members.map((m, idx) => {
            const isMe = m.user_id === meId;
            return (
              <View
                key={m.user_id}
                style={[styles.memberRow, isMe && styles.memberRowMe]}
              >
                <Text style={styles.rank}>#{idx + 1}</Text>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {m.display_name?.trim() || `@${m.username}`}
                  </Text>
                  {m.display_name?.trim() ? (
                    <Text style={styles.memberHandle}>@{m.username}</Text>
                  ) : null}
                </View>
                <View style={styles.memberStats}>
                  <Text style={styles.memberPoints}>
                    {m.monthly_points ?? 0} pts
                  </Text>
                  <Text style={styles.memberStreak}>
                    streak {m.current_streak ?? 0}
                  </Text>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.sectionTitle}>Recent activity</Text>
        <Text style={styles.empty}>
          Nothing yet — completed dares will show up here.
        </Text>
      </ScrollView>
    </SafeAreaView>
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
  errorText: { color: colors.danger, fontSize: 14, textAlign: 'center' },

  groupName: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.dark,
    letterSpacing: -0.5,
  },

  pillRow: {
    flexDirection: 'row',
    marginTop: 16,
    marginHorizontal: -6,
  },
  pill: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginHorizontal: 6,
    ...shadows.card,
  },
  pillLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pillValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },

  cta: {
    marginTop: 20,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  ctaPressed: { opacity: 0.85 },
  ctaText: { color: colors.background, fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
    marginTop: 24,
    marginBottom: 8,
  },
  empty: {
    color: colors.textMuted,
    fontSize: 14,
    paddingVertical: 8,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  memberRowMe: {
    backgroundColor: colors.surface,
  },
  rank: {
    width: 32,
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: colors.dark },
  memberHandle: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  memberStats: { alignItems: 'flex-end' },
  memberPoints: { fontSize: 14, fontWeight: '700', color: colors.dark },
  memberStreak: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
