import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import { colors, shadows } from '../../constants/theme';
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.headerLink}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>{error ?? 'Vote not available.'}</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerLink}>Back</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.mediaWrap}>
          {isVideo ? (
            <Pressable onPress={handleOpenVideo} style={styles.videoPressable}>
              <View style={styles.videoOverlay}>
                <View style={styles.playButton}>
                  <Text style={styles.playButtonText}>Play</Text>
                </View>
                <Text style={styles.videoCaption}>Tap to play video</Text>
              </View>
            </Pressable>
          ) : (
            <Image
              source={{ uri: submission.media_url }}
              style={styles.mediaImage}
              resizeMode="cover"
            />
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.title}>{dare.title}</Text>
          <Text style={styles.meta}>
            Submitted by {submitterName}
            {submittedAt ? ` • ${submittedAt}` : ''}
          </Text>

          <View style={styles.timerBox}>
            <Text style={styles.timerLabel}>Time left to vote</Text>
            <Text
              style={[
                styles.timerValue,
                remaining.urgent && styles.timerUrgent,
              ]}
            >
              {closed ? 'Closed' : remaining.text}
            </Text>
          </View>

          <View style={styles.tallyRow}>
            <View style={[styles.tallyChip, styles.tallyApproved]}>
              <Text style={styles.tallyText}>
                {votes.approved} approved
              </Text>
            </View>
            <View style={[styles.tallyChip, styles.tallyRejected]}>
              <Text style={styles.tallyText}>
                {votes.rejected} rejected
              </Text>
            </View>
          </View>

          {voteError ? <Text style={styles.errorText}>{voteError}</Text> : null}

          {viewer.is_sender ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>You sent this dare.</Text>
            </View>
          ) : viewer.is_submitter ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                You submitted this proof. Waiting on votes.
              </Text>
            </View>
          ) : closed ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>{statusLine(submission.status)}</Text>
            </View>
          ) : viewer.has_voted ? (
            <View style={styles.statusBox}>
              <Text style={styles.statusText}>
                You voted{' '}
                <Text style={styles.statusEmphasis}>{viewer.my_vote}</Text>.
              </Text>
            </View>
          ) : showVoteButtons ? (
            <View style={styles.actionsRow}>
              <Pressable
                onPress={() => handleVote('rejected')}
                disabled={!!voting}
                style={({ pressed }) => [
                  styles.rejectButton,
                  pressed && !voting && styles.buttonPressed,
                  voting && styles.buttonDimmed,
                ]}
              >
                {voting === 'rejected' ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.actionButtonText}>Reject</Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => handleVote('approved')}
                disabled={!!voting}
                style={({ pressed }) => [
                  styles.approveButton,
                  pressed && !voting && styles.buttonPressed,
                  voting && styles.buttonDimmed,
                ]}
              >
                {voting === 'approved' ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <Text style={styles.actionButtonText}>Approve</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  scroll: { paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },

  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },

  mediaWrap: {
    width: '100%',
    height: 400,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  mediaImage: { width: '100%', height: '100%' },
  videoPressable: { flex: 1, backgroundColor: colors.dark },
  videoOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    color: colors.dark,
    fontSize: 16,
    fontWeight: '700',
  },
  videoCaption: {
    marginTop: 12,
    color: colors.background,
    fontSize: 14,
  },

  body: { padding: 24 },
  title: { fontSize: 26, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  meta: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },

  timerBox: {
    marginTop: 20,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  timerLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timerValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: '700',
    color: colors.dark,
    fontVariant: ['tabular-nums'],
  },
  timerUrgent: { color: colors.danger },

  tallyRow: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  tallyChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  tallyApproved: { backgroundColor: colors.success },
  tallyRejected: { backgroundColor: colors.danger },
  tallyText: {
    color: colors.background,
    fontSize: 14,
    fontWeight: '700',
  },

  errorText: {
    marginTop: 16,
    color: colors.danger,
    fontSize: 13,
    textAlign: 'center',
  },

  statusBox: {
    marginTop: 20,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  statusText: {
    color: colors.text,
    fontSize: 14,
    textAlign: 'center',
  },
  statusEmphasis: { fontWeight: '700', color: colors.dark },

  actionsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  approveButton: {
    flex: 1,
    backgroundColor: colors.success,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  rejectButton: {
    flex: 1,
    backgroundColor: colors.danger,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.danger,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  actionButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  buttonPressed: { opacity: 0.85 },
  buttonDimmed: { opacity: 0.6 },
});
