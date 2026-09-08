import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import dayjs from 'dayjs';
import { supabase } from '../../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../../constants/theme';
import {
  Button,
  Card,
  ErrorState,
  IconButton,
  Loading,
  Pill,
  Screen,
  TopBar,
} from '../../components/ui';
import { CATEGORIES, DIFFICULTY_TIERS } from '../../api/dareApi';
import {
  pickMediaFromCamera,
  pickMediaFromLibrary,
  uploadProof,
} from '../../api/proofApi';

function rpcErrorMessage(err) {
  const m = err?.message ?? '';
  if (m.includes('not_authenticated')) return 'You need to be signed in.';
  if (m.includes('dare_not_found')) return 'That dare no longer exists.';
  if (m.includes('not_recipient')) return 'Only the dare recipient can do that.';
  if (m.includes('dare_not_pending')) return 'This dare can no longer be changed.';
  if (m.includes('no_swaps_remaining')) return 'You have no weekly swaps left.';
  return m || 'Something went wrong.';
}

function categoryLabelFor(key) {
  return CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

function difficultyTierFor(key) {
  return DIFFICULTY_TIERS.find((t) => t.key === key);
}

export default function DareDetail() {
  const { id } = useLocalSearchParams();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [dare, setDare] = useState(null);
  const [swapsRemaining, setSwapsRemaining] = useState(0);

  const [actionInFlight, setActionInFlight] = useState(null); // 'accept' | 'swap' | null
  const [actionError, setActionError] = useState(null);

  const [now, setNow] = useState(() => dayjs());

  const [selectedAsset, setSelectedAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const { data, error } = await supabase.rpc('get_dare_for_recipient', {
          p_dare_id: id,
        });
        if (error) throw error;
        if (cancelled) return;
        setDare(data);
        setSwapsRemaining(data?.viewer_swaps_remaining ?? 0);
      } catch (err) {
        if (!cancelled) setLoadError(rpcErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Live countdown — re-renders every second.
  useEffect(() => {
    const interval = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(interval);
  }, []);

  async function handleAccept() {
    setActionError(null);
    setActionInFlight('accept');
    try {
      const { error } = await supabase.rpc('accept_dare', { p_dare_id: id });
      if (error) throw error;
      setDare((prev) => (prev ? { ...prev, status: 'active' } : prev));
    } catch (err) {
      setActionError(rpcErrorMessage(err));
    } finally {
      setActionInFlight(null);
    }
  }

  function handleSwap() {
    if (swapsRemaining <= 0) return;
    Alert.alert(
      'Use weekly swap?',
      `This will replace this dare and spend 1 of your ${swapsRemaining} swap${
        swapsRemaining === 1 ? '' : 's'
      }.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Swap', style: 'destructive', onPress: confirmSwap },
      ]
    );
  }

  async function confirmSwap() {
    setActionError(null);
    setActionInFlight('swap');
    try {
      const { error } = await supabase.rpc('use_weekly_swap', { p_dare_id: id });
      if (error) throw error;
      router.back();
    } catch (err) {
      setActionError(rpcErrorMessage(err));
    } finally {
      setActionInFlight(null);
    }
  }

  function handleSubmitProof() {
    Alert.alert(
      'Submit proof',
      'Take a new photo/video or pick from your library.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Camera', onPress: () => pickAndShow(pickMediaFromCamera) },
        { text: 'Library', onPress: () => pickAndShow(pickMediaFromLibrary) },
      ]
    );
  }

  async function pickAndShow(picker) {
    setUploadError(null);
    try {
      const asset = await picker();
      if (asset) setSelectedAsset(asset);
    } catch (err) {
      Alert.alert('Could not open picker', err?.message ?? 'Try again.');
    }
  }

  async function handleConfirmUpload() {
    if (!selectedAsset || uploading) return;
    setUploadError(null);
    setUploading(true);
    setUploadProgress(0);
    try {
      await uploadProof({
        dareId: id,
        asset: selectedAsset,
        onProgress: setUploadProgress,
      });
      setDare((prev) =>
        prev ? { ...prev, status: 'awaiting_votes' } : prev
      );
      setSelectedAsset(null);
      setUploadProgress(0);
    } catch (err) {
      setUploadError(rpcErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function handleCancelUpload() {
    if (uploading) return;
    setSelectedAsset(null);
    setUploadError(null);
    setUploadProgress(0);
  }

  function handleFlag() {
    Alert.alert(
      'Report this dare?',
      'Reports help us keep Provd safe and fun.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Report',
          style: 'destructive',
          onPress: () =>
            Alert.alert('Reported', 'Thanks for letting us know.'),
        },
      ]
    );
  }

  if (loading) return <Loading />;
  if (loadError || !dare)
    return <ErrorState message={loadError ?? 'Dare not available.'} />;

  const tier = difficultyTierFor(dare.difficulty);
  const senderName =
    dare.sender?.display_name?.trim() ||
    (dare.sender?.username ? `@${dare.sender.username}` : 'someone');
  const sentAt = dare.created_at
    ? dayjs(dare.created_at).format('MMM D, h:mm A')
    : '';

  let countdownText = '—';
  let countdownUrgent = false;
  if (dare.expires_at) {
    const ms = dayjs(dare.expires_at).diff(now);
    if (ms <= 0) {
      countdownText = 'Expired';
      countdownUrgent = true;
    } else {
      const totalSeconds = Math.floor(ms / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const sec = totalSeconds % 60;
      countdownText =
        h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
      countdownUrgent = ms < 60 * 60 * 1000;
    }
  }

  const isPending = dare.status === 'pending';
  const isActive = dare.status === 'active';
  const isAwaitingVotes = dare.status === 'awaiting_votes';
  const isFinal = !isPending && !isActive && !isAwaitingVotes;

  const acceptDisabled = actionInFlight !== null;
  const swapDisabled = swapsRemaining <= 0 || actionInFlight !== null;

  return (
    <Screen>
      <TopBar right={<IconButton glyph="⚑" onPress={handleFlag} />} />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Card tone="lime" style={styles.hero}>
          <View style={styles.heroTop}>
            <Pill tone="neutral">{categoryLabelFor(dare.category)}</Pill>
            {tier ? (
              <Text style={styles.tier}>
                {tier.label} · {dare.points_value ?? tier.points} pts
              </Text>
            ) : null}
          </View>
          <Text style={styles.title}>{dare.title}</Text>
          <Text style={styles.meta}>
            From {senderName}
            {sentAt ? ` · ${sentAt}` : ''}
          </Text>
        </Card>

        {dare.description ? (
          <Card style={styles.card}>
            <Text style={styles.descLabel}>The rules</Text>
            <Text style={styles.description}>{dare.description}</Text>
          </Card>
        ) : null}

        <Card
          tone={countdownUrgent ? 'white' : 'navy'}
          style={styles.card}
        >
          <Text
            style={[styles.clockLabel, countdownUrgent && styles.clockLabelDark]}
          >
            Time remaining
          </Text>
          <Text
            style={[styles.countdown, countdownUrgent && styles.countdownUrgent]}
          >
            {countdownText}
          </Text>
        </Card>

        {actionError ? <Text style={styles.error}>{actionError}</Text> : null}

        {isPending ? (
          <View style={styles.actions}>
            <Button
              title="Accept dare"
              onPress={handleAccept}
              loading={actionInFlight === 'accept'}
              disabled={acceptDisabled}
            />
            <Button
              title={`Use weekly swap${
                swapsRemaining > 0 ? ` · ${swapsRemaining} left` : ''
              }`}
              variant="secondary"
              onPress={handleSwap}
              loading={actionInFlight === 'swap'}
              disabled={swapDisabled}
            />
          </View>
        ) : null}

        {isActive ? (
          <Button
            title="Submit proof"
            onPress={handleSubmitProof}
            style={styles.actions}
          />
        ) : null}

        {isAwaitingVotes ? (
          <Card style={styles.card}>
            <Pill tone="warn">Awaiting votes</Pill>
            <Text style={styles.noticeTitle}>Proof submitted</Text>
            <Text style={styles.noticeBody}>
              Your friends are voting on it now. We{'\u2019'}ll let you know how
              it lands.
            </Text>
          </Card>
        ) : null}

        {isFinal ? (
          <Card style={styles.card}>
            <Text style={styles.noticeBody}>This dare is {dare.status}.</Text>
          </Card>
        ) : null}
      </ScrollView>

      <Modal
        visible={!!selectedAsset}
        transparent
        animationType="slide"
        onRequestClose={handleCancelUpload}
      >
        {selectedAsset ? (
          <ProofUploadModalContent
            asset={selectedAsset}
            uploading={uploading}
            progress={uploadProgress}
            error={uploadError}
            onCancel={handleCancelUpload}
            onConfirm={handleConfirmUpload}
          />
        ) : null}
      </Modal>
    </Screen>
  );
}

function ProofUploadModalContent({
  asset,
  uploading,
  progress,
  error,
  onCancel,
  onConfirm,
}) {
  const isVideo = asset.type === 'video';
  const percent = Math.round((progress ?? 0) * 100);
  return (
    <View style={styles.modalBackdrop}>
      <View style={styles.modalSheet}>
        <View style={styles.grabber} />
        <Text style={styles.modalTitle}>Confirm proof</Text>
        <Text style={styles.modalSubtitle}>
          This is what your friends will vote on.
        </Text>

        {isVideo ? (
          <View style={styles.videoPreview}>
            <Text style={styles.videoLabel}>Video selected</Text>
            {asset.fileName ? (
              <Text style={styles.videoMeta}>{asset.fileName}</Text>
            ) : null}
            {asset.duration ? (
              <Text style={styles.videoMeta}>
                {Math.round(asset.duration / 1000)}s
              </Text>
            ) : null}
          </View>
        ) : (
          <Image
            source={{ uri: asset.uri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
        )}

        {uploading ? (
          <View style={styles.progressWrap}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.progressText}>Uploading… {percent}%</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.modalActions}>
          <Button
            title="Cancel"
            variant="secondary"
            onPress={onCancel}
            disabled={uploading}
            style={styles.modalBtn}
          />
          <Button
            title="Upload"
            onPress={onConfirm}
            loading={uploading}
            style={styles.modalBtn}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxxl },

  hero: {},
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tier: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    color: colors.limeInk,
    opacity: 0.75,
  },
  title: {
    fontFamily: fonts.sansBold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: colors.limeInk,
    marginTop: space.md,
  },
  meta: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.limeInk,
    opacity: 0.7,
    marginTop: space.sm,
  },

  card: { marginTop: space.md },
  descLabel: { ...type.label, marginBottom: space.xs },
  description: { ...type.body, fontSize: 15 },

  clockLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  clockLabelDark: { color: colors.muted },
  countdown: {
    fontFamily: fonts.sansBold,
    fontSize: 36,
    lineHeight: 46,
    letterSpacing: -1,
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
    marginTop: space.xs,
  },
  countdownUrgent: { color: colors.accent },

  error: {
    marginTop: space.md,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
  },

  actions: { marginTop: space.xl, gap: space.md },

  noticeTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    color: colors.ink,
    marginTop: space.md,
  },
  noticeBody: { ...type.body, marginTop: space.xs },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20,21,26,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.xxxl,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: space.xl,
  },
  modalTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 22,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  modalSubtitle: { ...type.bodyMuted, marginTop: space.xs },

  previewImage: {
    width: '100%',
    height: 250,
    borderRadius: radius.lg,
    marginTop: space.xl,
    backgroundColor: colors.surface,
  },
  videoPreview: {
    marginTop: space.xl,
    padding: space.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  videoLabel: { fontFamily: fonts.sansBold, fontSize: 14, color: colors.ink },
  videoMeta: { ...type.small, marginTop: 2 },

  progressWrap: { marginTop: space.xl },
  progressTrack: {
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  progressFill: { height: 7, borderRadius: 4, backgroundColor: colors.accent },
  progressText: { ...type.small, marginTop: space.sm },

  modalActions: { flexDirection: 'row', gap: space.md, marginTop: space.xl },
  modalBtn: { flex: 1 },
});
