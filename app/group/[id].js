import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { listGroupDareHistory, outcomeFor } from '../../api/historyApi';
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
  TopBar,
} from '../../components/ui';

export default function GroupDetail() {
  const { id } = useLocalSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [overview, setOverview] = useState(null);
  const [history, setHistory] = useState([]);
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

        // Shared activity feed — best-effort, never blocks the group view.
        try {
          const rows = await listGroupDareHistory(id);
          if (!cancelled) setHistory(rows);
        } catch {
          if (!cancelled) setHistory([]);
        }
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

  if (loading) return <Loading />;
  if (error || !overview)
    return <ErrorState message={error ?? 'Group not available.'} />;

  const members = overview.members ?? [];
  const myIndex = meId ? members.findIndex((m) => m.user_id === meId) : -1;
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const daysRemaining = dayjs()
    .endOf('month')
    .diff(dayjs().startOf('day'), 'day');
  const code = overview.invite_code;
  const top = members[0]?.monthly_points || 1;

  async function handleShareCode() {
    if (!code) return;
    try {
      await Share.share({
        message: `Join "${overview.name}" on Provd — invite code ${code}`,
      });
    } catch {
      // user dismissed the sheet
    }
  }

  return (
    <Screen>
      <TopBar
        right={
          code ? <IconButton glyph="↗" onPress={handleShareCode} /> : null
        }
      />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.groupName}>{overview.name}</Text>

        <Card tone="navy" style={styles.headCard}>
          <View style={styles.headStats}>
            <Stat
              value={myRank ? `#${myRank}` : '—'}
              label={`of ${members.length}`}
              tone="onDark"
            />
            <View style={styles.vDivider} />
            <Stat value={daysRemaining} label="Days left" tone="onDark" />
          </View>
          {code ? (
            <Pressable
              onPress={handleShareCode}
              style={({ pressed }) => [styles.code, pressed && styles.pressed]}
            >
              <Text style={styles.codeLabel}>Invite code</Text>
              <Text style={styles.codeValue}>{code}</Text>
            </Pressable>
          ) : null}
        </Card>

        <Button
          title="Send a new dare"
          onPress={() => router.push(`/create-dare?groupId=${id}`)}
          style={styles.cta}
        />

        <SectionTitle style={styles.section}>Standings</SectionTitle>
        {members.length === 0 ? (
          <Card>
            <Empty>No members yet.</Empty>
          </Card>
        ) : (
          <Card>
            {members.map((m, idx) => {
              const isMe = m.user_id === meId;
              const pct = Math.round(((m.monthly_points ?? 0) / top) * 100);
              return (
                <View
                  key={m.user_id}
                  style={[styles.member, idx > 0 && styles.memberDivided]}
                >
                  <View style={styles.memberTop}>
                    <View
                      style={[styles.rankDot, isMe && styles.rankDotMe]}
                    >
                      <Text
                        style={[styles.rankNum, isMe && styles.rankNumMe]}
                      >
                        {idx + 1}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {m.display_name?.trim() || `@${m.username}`}
                        {isMe ? ' · you' : ''}
                      </Text>
                      <Text style={styles.memberMeta}>
                        @{m.username} · {m.current_streak ?? 0} day streak
                      </Text>
                    </View>
                    <Text style={styles.memberPoints}>
                      {m.monthly_points ?? 0}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${pct}%`,
                          backgroundColor: isMe ? colors.accent : colors.lime,
                        },
                      ]}
                    />
                  </View>
                </View>
              );
            })}
          </Card>
        )}

        <SectionTitle style={styles.section}>Recent activity</SectionTitle>
        {history.length === 0 ? (
          <Card>
            <Empty>Nothing yet — finished dares will show up here.</Empty>
          </Card>
        ) : (
          <Card>
            {history.map((d, i) => {
              const outcome = outcomeFor(d.status);
              const won = outcome.key === 'completed';
              const who =
                d.target?.display_name?.trim() ||
                (d.target?.username ? `@${d.target.username}` : 'Someone');
              return (
                <View
                  key={d.id}
                  style={[styles.actRow, i > 0 && styles.memberDivided]}
                >
                  <View
                    style={[styles.actDot, won ? styles.dotWon : styles.dotLost]}
                  >
                    <Text style={styles.actDotText}>{won ? '✓' : '✕'}</Text>
                  </View>
                  <View style={styles.actMain}>
                    <Text style={styles.actTitle} numberOfLines={1}>
                      {d.title}
                    </Text>
                    <Text style={styles.actMeta}>
                      {who} · {outcome.label}
                      {d.settled_at
                        ? ` · ${dayjs(d.settled_at).format('MMM D')}`
                        : ''}
                    </Text>
                  </View>
                  <Text
                    style={[styles.actPts, won ? styles.ptsWon : styles.ptsLost]}
                  >
                    {won ? `+${d.points_value}` : '—'}
                  </Text>
                </View>
              );
            })}
          </Card>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxxl },

  groupName: { ...type.display, marginBottom: space.lg },

  headCard: {},
  headStats: { flexDirection: 'row', alignItems: 'center', gap: space.xl },
  vDivider: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.16)' },

  code: {
    marginTop: space.xl,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  codeLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  codeValue: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    letterSpacing: 5,
    color: colors.lime,
    marginTop: 2,
  },

  cta: { marginTop: space.md },
  section: { marginTop: space.xxl },

  member: { paddingVertical: space.md },
  memberDivided: { borderTopWidth: 1, borderTopColor: colors.line },
  memberTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rankDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankDotMe: { backgroundColor: colors.accent },
  rankNum: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.muted },
  rankNumMe: { color: '#FFFFFF' },
  memberInfo: { flex: 1 },
  memberName: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  memberMeta: { ...type.small, marginTop: 1 },
  memberPoints: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.surface,
    marginTop: space.sm,
    marginLeft: 38,
    overflow: 'hidden',
  },
  barFill: { height: 5, borderRadius: 3 },

  actRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  actDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotWon: { backgroundColor: colors.successSoft },
  dotLost: { backgroundColor: colors.dangerSoft },
  actDotText: { fontFamily: fonts.sansBold, fontSize: 12, color: colors.ink },
  actMain: { flex: 1 },
  actTitle: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  actMeta: { ...type.small, marginTop: 1 },
  actPts: { fontFamily: fonts.sansBold, fontSize: 14 },
  ptsWon: { color: colors.success },
  ptsLost: { color: colors.muted },

  pressed: { opacity: 0.65 },
});
