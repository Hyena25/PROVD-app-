import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError || !dare) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.headerLink}>Back</Text>
          </Pressable>
        </View>
        <View style={styles.center}>
          <Text style={styles.errorText}>
            {loadError ?? 'Dare not available.'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

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
      const s = totalSeconds % 60;
      countdownText =
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
      countdownUrgent = ms < 60 * 60 * 1000; // under 1 hour
    }
  }

  const isPending = dare.status === 'pending';
  const isActive = dare.status === 'active';
  const isAwaitingVotes = dare.status === 'awaiting_votes';
  const isFinal = !isPending && !isActive && !isAwaitingVotes;

  const acceptDisabled = actionInFlight !== null;
  const swapDisabled = swapsRemaining <= 0 || actionInFlight !== null;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.headerRow}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.headerLink}>Back</Text>
        </Pressable>
        <Pressable
          onPress={handleFlag}
          hitSlop={10}
          style={({ pressed }) => [
            styles.flagButton,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.flagText}>Report</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{dare.title}</Text>
        <Text style={styles.meta}>
          From {senderName}
          {sentAt ? ` • ${sentAt}` : ''}
        </Text>

        <View style={styles.tagsRow}>
          <View style={styles.categoryTag}>
            <Text style={styles.categoryTagText}>
              {categoryLabelFor(dare.category)}
            </Text>
          </View>
          {tier ? (
            <View
              style={[styles.difficultyTag, { backgroundColor: tier.color }]}
            >
              <Text style={styles.difficultyTagText}>
                {tier.label} • {dare.points_value ?? tier.points} pts
              </Text>
            </View>
          ) : null}
        </View>

        {dare.description ? (
          <Text style={styles.description}>{dare.description}</Text>
        ) : null}

        <View style={styles.countdownBox}>
          <Text style={styles.countdownLabel}>Time remaining</Text>
          <Text
            style={[
              styles.countdown,
              countdownUrgent && styles.countdownUrgent,
            ]}
          >
            {countdownText}
          </Text>
        </View>

        {actionError ? (
          <Text style={styles.errorText}>{actionError}</Text>
        ) : null}

        {isPending ? (
          <View style={styles.actionsCol}>
            <Pressable
              onPress={handleAccept}
              disabled={acceptDisabled}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !acceptDisabled && styles.buttonPressed,
                acceptDisabled && styles.buttonDimmed,
              ]}
            >
              {actionInFlight === 'accept' ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <Text style={styles.primaryButtonText}>Accept Dare</Text>
              )}
            </Pressable>
            <Pressable
              onPress={handleSwap}
              disabled={swapDisabled}
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && !swapDisabled && styles.buttonPressed,
                swapDisabled && styles.secondaryButtonDisabled,
              ]}
            >
              {actionInFlight === 'swap' ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <Text
                  style={[
                    styles.secondaryButtonText,
                    swapDisabled && styles.secondaryButtonTextDisabled,
                  ]}
                >
                  Use Weekly Swap
                  {swapsRemaining > 0 ? ` (${swapsRemaining})` : ''}
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        {isActive ? (
          <Pressable
            onPress={handleSubmitProof}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.fullWidthButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={styles.primaryButtonText}>Submit Proof</Text>
          </Pressable>
        ) : null}

        {isAwaitingVotes ? (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Proof submitted</Text>
            <Text style={styles.reviewBody}>
              Your proof is under review. We'll let you know once your friends
              have voted.
            </Text>
          </View>
        ) : null}

        {isFinal ? (
          <Text style={styles.statusNote}>This dare is {dare.status}.</Text>
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
    </SafeAreaView>
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
      <View style={styles.modalCard}>
        <Text style={styles.modalTitle}>Confirm proof</Text>
        <Text style={styles.modalSubtitle}>
          Make sure this is the proof you want your friends to vote on.
        </Text>

        {isVideo ? (
          <View style={styles.videoPreview}>
            <Text style={styles.videoPreviewLabel}>Video selected</Text>
            {asset.fileName ? (
              <Text style={styles.videoPreviewMeta}>{asset.fileName}</Text>
            ) : null}
            {asset.duration ? (
              <Text style={styles.videoPreviewMeta}>
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
            <View style={styles.progressBarBg}>
              <View
                style={[styles.progressBarFill, { width: `${percent}%` }]}
              />
            </View>
            <Text style={styles.progressText}>Uploading… {percent}%</Text>
          </View>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.modalActions}>
          <Pressable
            onPress={onCancel}
            disabled={uploading}
            style={({ pressed }) => [
              styles.secondaryButton,
              styles.modalActionButton,
              pressed && !uploading && styles.buttonPressed,
              uploading && styles.buttonDimmed,
            ]}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={uploading}
            style={({ pressed }) => [
              styles.primaryButton,
              styles.modalActionButton,
              pressed && !uploading && styles.buttonPressed,
              uploading && styles.buttonDimmed,
            ]}
          >
            {uploading ? (
              <ActivityIndicator color={colors.background} />
            ) : (
              <Text style={styles.primaryButtonText}>Confirm and Upload</Text>
            )}
          </Pressable>
        </View>
      </View>
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

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLink: { color: colors.accent, fontSize: 15, fontWeight: '600' },
  flagButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  flagText: { color: colors.danger, fontSize: 13, fontWeight: '600' },

  title: { fontSize: 30, fontWeight: '800', color: colors.dark, letterSpacing: -0.5 },
  meta: { fontSize: 14, color: colors.textMuted, marginTop: 6 },

  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -4,
  },
  categoryTag: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  categoryTagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  difficultyTag: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },
  difficultyTagText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '700',
  },

  description: {
    marginTop: 16,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },

  countdownBox: {
    marginTop: 24,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    ...shadows.card,
  },
  countdownLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  countdown: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
    fontVariant: ['tabular-nums'],
  },
  countdownUrgent: { color: colors.danger },

  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },

  actionsCol: { marginTop: 24, gap: 12 },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadows.button,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButton: {
    backgroundColor: colors.background,
    borderColor: colors.accent,
    borderWidth: 1.5,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.accent,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondaryButtonDisabled: {
    borderColor: colors.textMuted,
    opacity: 0.6,
  },
  secondaryButtonTextDisabled: { color: colors.textMuted },

  buttonPressed: { opacity: 0.85 },
  buttonDimmed: { opacity: 0.6 },
  fullWidthButton: { marginTop: 24 },

  statusNote: {
    marginTop: 24,
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },

  reviewBox: {
    marginTop: 24,
    backgroundColor: colors.background,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...shadows.card,
  },
  reviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.dark,
  },
  reviewBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 32,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.dark,
  },
  modalSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: colors.textMuted,
  },

  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: colors.surface,
  },
  videoPreview: {
    width: '100%',
    height: 160,
    borderRadius: 12,
    marginTop: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPreviewLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.dark,
  },
  videoPreviewMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textMuted,
  },

  progressWrap: { marginTop: 16 },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.surface,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 999,
  },
  progressText: {
    marginTop: 6,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },

  modalActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  modalActionButton: { flex: 1 },
});
