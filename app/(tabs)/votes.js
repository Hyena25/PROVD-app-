import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import dayjs from 'dayjs';
import { colors, fonts, gutter, space, type } from '../../constants/theme';
import { listPendingVotesForUser } from '../../api/voteApi';
import {
  Card,
  Empty,
  ErrorState,
  Loading,
  Pill,
  Screen,
} from '../../components/ui';

/** Minutes left to vote, or null when there's no deadline. */
function minutesLeft(deadline) {
  if (!deadline) return null;
  const ms = dayjs(deadline).diff(dayjs());
  if (ms <= 0) return 0;
  return Math.ceil(ms / 60000);
}

export default function Votes() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [votes, setVotes] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setVotes((await listPendingVotesForUser()) ?? []);
    } catch (err) {
      setError(err?.message ?? 'Could not load your votes.');
    }
  }, []);

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

  if (loading) return <Loading />;
  if (error) return <ErrorState message={error} onRetry={load} back={false} />;

  return (
    <Screen>
      <View style={styles.head}>
        <Text style={styles.title}>Votes</Text>
        <Text style={styles.subtitle}>
          {votes.length === 0
            ? 'Nothing waiting on you.'
            : `${votes.length} proof${votes.length === 1 ? '' : 's'} need your call.`}
        </Text>
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
        {votes.length === 0 ? (
          <Card>
            <Empty>
              You{'’'}re all caught up. New proof from your groups will
              show up here with a timer.
            </Empty>
          </Card>
        ) : (
          votes.map((v) => {
            const mins = minutesLeft(v.voting_deadline);
            const urgent = mins !== null && mins <= 15;
            return (
              <Card
                key={v.submission_id}
                style={styles.voteCard}
                onPress={() => router.push(`/vote/${v.submission_id}`)}
              >
                <View style={styles.voteTop}>
                  <Pill tone={v.media_type === 'video' ? 'neutral' : 'neutral'}>
                    {v.media_type === 'video' ? 'Video' : 'Photo'}
                  </Pill>
                  {mins !== null ? (
                    <Pill tone={urgent ? 'danger' : 'warn'}>
                      {mins === 0 ? 'Closing' : `${mins} min left`}
                    </Pill>
                  ) : null}
                </View>

                <Text style={styles.voteTitle}>{v.dare_title}</Text>
                <Text style={styles.voteMeta}>
                  Submitted by @{v.submitter_username}
                </Text>

                <View style={styles.voteCta}>
                  <Text style={styles.voteCtaText}>Review proof</Text>
                  <Text style={styles.voteChevron}>›</Text>
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
  head: {
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  title: { ...type.display, fontSize: 32, lineHeight: 38 },
  subtitle: { ...type.bodyMuted, marginTop: space.xs },

  scroll: { paddingHorizontal: gutter, paddingBottom: 120 },

  voteCard: { marginBottom: space.md },
  voteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  voteTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.4,
    color: colors.ink,
    marginTop: space.md,
  },
  voteMeta: { ...type.small, marginTop: 2 },

  voteCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  voteCtaText: {
    fontFamily: fonts.sansBold,
    fontSize: 14,
    color: colors.accent,
  },
  voteChevron: { fontSize: 20, color: colors.accent },
});
