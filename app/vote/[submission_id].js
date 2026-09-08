import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import { colors, fonts, gutter, radius, space, type } from '../../constants/theme';
import {
  Card,
  ErrorState,
  Loading,
  Pill,
  Screen,
  SegmentBar,
  TopBar,
} from '../../components/ui';
import { castVote, getSubmissionForVoter } from '../../api/voteApi';

function formatRemaining(ms) {
  if (ms <= 0) return { text: 'Voting closed', urgent: true };
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const text = `${m}:${String(s).padStart(2, '0')}`;
  return { text, urgent: ms < 5 * 60 * 1000 };
}

function statusLine(status) {
  if (status === 'approved') return 'Voting closed — proof was approved.';
  if (status === 'rejected') return 'Voting closed — proof was rejected.';
  return 'Voting is closed.';
}

export default function VoteScreen() {
  const { submission_id: submissionId } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const [voting, setVoting] = useState(null); // 'approved' | 'rejected' | null
  const [voteError, setVoteError] = useState(null);

  const [now, setNow] = useState(() => dayjs());
  const expiredRefetchedRef = useRef(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const payload = await getSubmissionForVoter(submissionId);
      setData(payload);
    } catch (err) {
      setError(err?.message ?? 'Could not load this vote.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!submissionId) return;
    expiredRefetchedRef.current = false;
    load();
  }, [submissionId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-refetch once when the countdown hits zero so the server can finalise.
  useEffect(() => {
    if (!data || expiredRefetchedRef.current) return;
    if (data.viewer?.voting_closed) return;
    if (!data.voting_deadline) return;
    const ms = dayjs(data.voting_deadline).diff(now);
    if (ms <= 0) {
      expiredRefetchedRef.current = true;
      load();
    }
  }, [now, data]);

  async function handleVote(vote) {
    if (voting) return;
    setVoting(vote);
    setVoteError(null);
    try {
      await castVote(submissionId, vote);
      await load();
    } catch (err) {
      setVoteError(err?.message ?? 'Could not record your vote.');
    } finally {
      setVoting(null);
    }
  }

  function handleOpenVideo() {
    if (data?.submission?.media_url) {
      Linking.openURL(data.submission.media_url).catch(() => {});
    }
  }

  if (loading) return <Loading />;
  if (error || !data)
    return <ErrorState message={error ?? 'Vote not available.'} />;

  const { submission, dare, submitter, viewer, votes, voting_deadline } = data;
  const isVideo = submission.media_type === 'video';
  const submittedAt = submission.submitted_at
    ? dayjs(submission.submitted_at).format('MMM D, h:mm A')
    : '';
  const submitterName =
    submitter?.display_name?.trim() ||
    (submitter?.username ? `@${submitter.username}` : 'someone');

  const remainingMs = voting_deadline ? dayjs(voting_deadline).diff(now) : 0;
  const remaining = formatRemaining(remainingMs);

  const closed = viewer.voting_closed || submission.status !== 'pending';
  const showVoteButtons =
    !closed && !viewer.is_sender && !viewer.is_submitter && !viewer.has_voted;

  const total = (votes.approved ?? 0) + (votes.rejected ?? 0);

  return (
    <Screen>
      <TopBar />
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <Pressable
              onPress={handleOpenVideo}
              style={({ pressed }) => [styles.video, pressed && styles.pressed]}
            >
              <View style={styles.playDot}>
                <Text style={styles.playGlyph}>▶</Text>
              </View>
              <Text style={styles.playLabel}>Tap to play</Text>
            </Pressable>
          ) : (
            <Image
              source={{ uri: submission.media_url }}
              style={styles.image}
              resizeMode="cover"
            />
          )}
          <View style={styles.clockChip}>
            <Text
              style={[
                styles.clockText,
                remaining.urgent && styles.clockUrgent,
              ]}
            >
              {closed ? 'Closed' : remaining.text}
            </Text>
          </View>
        </View>

        <Card style={styles.card}>
          <Text style={styles.title}>{dare.title}</Text>
          <Text style={styles.meta}>
            {submitterName}
            {submittedAt ? ` · ${submittedAt}` : ''}
          </Text>

          <View style={styles.tallyTop}>
            <Text style={type.label}>Votes so far</Text>
            <Text style={styles.tallyTotal}>{total}</Text>
          </View>
          <SegmentBar
            segments={[
              { flex: votes.rejected ?? 0, color: colors.danger },
              { flex: votes.approved ?? 0, color: colors.success },
            ]}
          />
          <View style={styles.legend}>
            <Text style={styles.legendRejected}>
              {votes.rejected} rejected
            </Text>
            <Text style={styles.legendApproved}>
              {votes.approved} approved
            </Text>
          </View>
        </Card>

        {voteError ? <Text style={styles.error}>{voteError}</Text> : null}

        {viewer.is_sender ? (
          <Card style={styles.card}>
            <Pill tone="neutral">Your dare</Pill>
            <Text style={styles.status}>
              You sent this dare, so you can{'\u2019'}t vote on it.
            </Text>
          </Card>
        ) : viewer.is_submitter ? (
          <Card style={styles.card}>
            <Pill tone="warn">Your proof</Pill>
            <Text style={styles.status}>Waiting on your friends.</Text>
          </Card>
        ) : closed ? (
          <Card style={styles.card}>
            <Text style={styles.status}>{statusLine(submission.status)}</Text>
          </Card>
        ) : viewer.has_voted ? (
          <Card style={styles.card}>
            <Pill tone={viewer.my_vote === 'approved' ? 'success' : 'danger'}>
              You voted {viewer.my_vote}
            </Pill>
          </Card>
        ) : showVoteButtons ? (
          <View style={styles.actions}>
            <Pressable
              onPress={() => handleVote('rejected')}
              disabled={!!voting}
              style={({ pressed }) => [
                styles.voteBtn,
                styles.rejectBtn,
                pressed && !voting && styles.pressed,
                !!voting && styles.dimmed,
              ]}
            >
              {voting === 'rejected' ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={[styles.voteText, { color: colors.danger }]}>
                  Reject
                </Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => handleVote('approved')}
              disabled={!!voting}
              style={({ pressed }) => [
                styles.voteBtn,
                styles.approveBtn,
                pressed && !voting && styles.pressed,
                !!voting && styles.dimmed,
              ]}
            >
              {voting === 'approved' ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={[styles.voteText, { color: '#FFFFFF' }]}>
                  Approve
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxxl },

  mediaWrap: {},
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  video: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.card,
    backgroundColor: colors.navy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playDot: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playGlyph: { fontSize: 22, color: colors.limeInk },
  playLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: space.md,
  },
  clockChip: {
    position: 'absolute',
    top: space.md,
    right: space.md,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
  },
  clockText: {
    fontFamily: fonts.sansBold,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  clockUrgent: { color: colors.accent },

  card: { marginTop: space.md },

  title: {
    fontFamily: fonts.sansBold,
    fontSize: 21,
    lineHeight: 27,
    letterSpacing: -0.6,
    color: colors.ink,
  },
  meta: { ...type.small, marginTop: space.xs },

  tallyTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.sm,
  },
  tallyTotal: {
    fontFamily: fonts.sansBold,
    fontSize: 15,
    color: colors.ink,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.sm,
  },
  legendApproved: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.success,
  },
  legendRejected: {
    fontFamily: fonts.sansMedium,
    fontSize: 12.5,
    color: colors.danger,
  },

  error: {
    marginTop: space.md,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
  },
  status: { ...type.body, marginTop: space.sm },

  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  voteBtn: {
    flex: 1,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rejectBtn: {
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  approveBtn: { backgroundColor: colors.success },
  voteText: { fontFamily: fonts.sansBold, fontSize: 15 },

  pressed: { opacity: 0.65 },
  dimmed: { opacity: 0.4 },
});
