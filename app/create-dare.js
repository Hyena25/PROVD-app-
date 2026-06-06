import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors } from '../constants/theme';
import {
  CATEGORIES,
  DIFFICULTY_TIERS,
  createDare,
  fetchDareLibrary,
} from '../api/dareApi';
import { generateDares } from '../api/aiApi';

const MAX_TITLE_LENGTH = 200;
const TABS = [
  { key: 'write', label: 'Write your own' },
  { key: 'library', label: 'Pick from library' },
  { key: 'ai', label: 'AI generator' },
];

function difficultyTierFor(key) {
  return DIFFICULTY_TIERS.find((t) => t.key === key) ?? null;
}

export default function CreateDare() {
  const { groupId } = useLocalSearchParams();

  const [activeTab, setActiveTab] = useState('write');

  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [loadError, setLoadError] = useState(null);

  const [targetUserId, setTargetUserId] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(null);
  const [difficulty, setDifficulty] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [libraryCategory, setLibraryCategory] = useState('fitness');
  const [libraryItems, setLibraryItems] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState(null);

  const [aiDescription, setAiDescription] = useState('');
  const [aiDares, setAiDares] = useState([]);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState(null);

  useEffect(() => {
    if (!groupId) {
      setLoadingMembers(false);
      setLoadError('Open this screen from a group to create a dare.');
      return;
    }

    let cancelled = false;
    async function load() {
      setLoadingMembers(true);
      setLoadError(null);
      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error('You must be signed in.');

        const { data, error: rpcError } = await supabase.rpc(
          'get_group_overview',
          { p_group_id: groupId }
        );
        if (rpcError) {
          const m = rpcError.message ?? '';
          if (m.includes('not_a_member')) throw new Error('You are not a member of this group.');
          if (m.includes('group_not_found')) throw new Error('That group does not exist.');
          throw rpcError;
        }
        if (cancelled) return;
        const others = (data?.members ?? []).filter((m) => m.user_id !== user.id);
        setMembers(others);
      } catch (err) {
        if (!cancelled) setLoadError(err?.message ?? 'Could not load group members.');
      } finally {
        if (!cancelled) setLoadingMembers(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (activeTab !== 'library') return;
    let cancelled = false;
    setLibraryLoading(true);
    setLibraryError(null);
    fetchDareLibrary({ category: libraryCategory })
      .then((items) => {
        if (!cancelled) setLibraryItems(items);
      })
      .catch((err) => {
        if (!cancelled) setLibraryError(err?.message ?? 'Could not load the library.');
      })
      .finally(() => {
        if (!cancelled) setLibraryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, libraryCategory]);

  function pickLibraryItem(item) {
    setTitle(item.title);
    setDescription(item.description ?? '');
    setActiveTab('write');
  }

  async function handleGenerate() {
    const trimmed = aiDescription.trim();
    if (!trimmed) {
      setAiError('Describe your friend so I can come up with dares.');
      return;
    }
    setAiError(null);
    setAiGenerating(true);
    try {
      const dares = await generateDares({ description: trimmed });
      setAiDares(dares);
    } catch (err) {
      setAiError(err?.message ?? 'Could not generate dares. Try again.');
    } finally {
      setAiGenerating(false);
    }
  }

  function pickAiDare(dare) {
    setTitle(dare.title ?? '');
    setDescription(dare.description ?? '');
    setActiveTab('write');
  }

  async function handleSubmit() {
    setSubmitError(null);
    const trimmedTitle = title.trim();
    if (!targetUserId) {
      setSubmitError('Pick someone to dare.');
      return;
    }
    if (!trimmedTitle) {
      setSubmitError('Give your dare a title.');
      return;
    }
    if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      setSubmitError(`Title must be ${MAX_TITLE_LENGTH} characters or fewer.`);
      return;
    }
    if (!category) {
      setSubmitError('Pick a category.');
      return;
    }
    if (!difficulty) {
      setSubmitError('Pick a difficulty.');
      return;
    }

    setSubmitting(true);
    try {
      await createDare({
        title: trimmedTitle,
        description,
        category,
        difficulty,
        targetUserId,
        groupId,
      });
      router.replace(`/group/${groupId}`);
    } catch (err) {
      setSubmitError(err?.message ?? 'Could not create the dare. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMembers) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.tabBar}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => !tab.disabled && setActiveTab(tab.key)}
                disabled={tab.disabled}
                style={[
                  styles.tab,
                  active && styles.tabActive,
                  tab.disabled && styles.tabDisabled,
                ]}
              >
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  style={[
                    styles.tabText,
                    active && styles.tabTextActive,
                    tab.disabled && styles.tabTextDisabled,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'write' && (
            <WriteTab
              members={members}
              targetUserId={targetUserId}
              setTargetUserId={setTargetUserId}
              title={title}
              setTitle={setTitle}
              description={description}
              setDescription={setDescription}
              category={category}
              setCategory={setCategory}
              difficulty={difficulty}
              setDifficulty={setDifficulty}
              submitting={submitting}
              submitError={submitError}
              onSubmit={handleSubmit}
            />
          )}
          {activeTab === 'library' && (
            <LibraryTab
              libraryCategory={libraryCategory}
              setLibraryCategory={setLibraryCategory}
              items={libraryItems}
              loading={libraryLoading}
              error={libraryError}
              onPick={pickLibraryItem}
            />
          )}
          {activeTab === 'ai' && (
            <AITab
              description={aiDescription}
              setDescription={setAiDescription}
              dares={aiDares}
              generating={aiGenerating}
              error={aiError}
              onGenerate={handleGenerate}
              onPick={pickAiDare}
            />
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function WriteTab({
  members,
  targetUserId,
  setTargetUserId,
  title,
  setTitle,
  description,
  setDescription,
  category,
  setCategory,
  difficulty,
  setDifficulty,
  submitting,
  submitError,
  onSubmit,
}) {
  return (
    <>
      <Text style={styles.title}>New dare</Text>

      <Text style={styles.sectionLabel}>Target</Text>
      {members.length === 0 ? (
        <Text style={styles.empty}>No other members in this group yet.</Text>
      ) : (
        <View style={styles.chipRow}>
          {members.map((m) => {
            const selected = targetUserId === m.user_id;
            return (
              <Pressable
                key={m.user_id}
                onPress={() => setTargetUserId(m.user_id)}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <Text
                  style={[styles.chipText, selected && styles.chipTextSelected]}
                >
                  {m.display_name?.trim() || `@${m.username}`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionLabel}>Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Run a mile in under 8 minutes"
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        maxLength={MAX_TITLE_LENGTH}
        editable={!submitting}
      />
      <Text style={styles.helper}>
        {title.length}/{MAX_TITLE_LENGTH}
      </Text>

      <Text style={styles.sectionLabel}>Description (optional)</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="Add any rules or context"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textarea]}
        multiline
        editable={!submitting}
      />

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => {
          const selected = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Difficulty</Text>
      <View style={styles.tierList}>
        {DIFFICULTY_TIERS.map((t) => {
          const selected = difficulty === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setDifficulty(t.key)}
              style={[
                styles.tier,
                { borderColor: t.color },
                selected && { backgroundColor: t.color, borderColor: t.color },
              ]}
            >
              <View style={styles.tierMain}>
                <Text style={[styles.tierLabel, selected && styles.tierTextOnFill]}>
                  {t.label}
                </Text>
                <Text style={[styles.tierMeta, selected && styles.tierTextOnFill]}>
                  {t.points} pts • {t.hours}h window
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {submitError && <Text style={styles.errorText}>{submitError}</Text>}

      <Pressable
        onPress={onSubmit}
        disabled={submitting}
        style={({ pressed }) => [
          styles.submitButton,
          (submitting || pressed) && styles.submitButtonPressed,
        ]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.submitText}>Send dare</Text>
        )}
      </Pressable>
    </>
  );
}

function LibraryTab({
  libraryCategory,
  setLibraryCategory,
  items,
  loading,
  error,
  onPick,
}) {
  return (
    <>
      <Text style={styles.title}>Pick a dare</Text>
      <Text style={styles.subtitle}>
        Tap one to drop it into the Write tab. You can edit before sending.
      </Text>

      <Text style={styles.sectionLabel}>Category</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => {
          const selected = libraryCategory === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setLibraryCategory(c.key)}
              style={[styles.chip, selected && styles.chipSelected]}
            >
              <Text
                style={[styles.chipText, selected && styles.chipTextSelected]}
              >
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.libraryListWrap}>
        {loading ? (
          <View style={styles.libraryLoadingRow}>
            <ActivityIndicator color={colors.accent} />
            <Text style={styles.libraryLoadingText}>Loading dares…</Text>
          </View>
        ) : error ? (
          <Text style={styles.errorText}>{error}</Text>
        ) : items.length === 0 ? (
          <Text style={styles.empty}>No dares in this category yet.</Text>
        ) : (
          items.map((item) => {
            const tier = difficultyTierFor(item.suggested_difficulty);
            return (
              <Pressable
                key={item.id}
                onPress={() => onPick(item)}
                style={({ pressed }) => [
                  styles.libraryItem,
                  pressed && styles.libraryItemPressed,
                ]}
              >
                <Text style={styles.libraryTitle}>{item.title}</Text>
                {item.description ? (
                  <Text style={styles.libraryDescription} numberOfLines={2}>
                    {item.description}
                  </Text>
                ) : null}
                {tier ? (
                  <View
                    style={[
                      styles.libraryBadge,
                      { backgroundColor: tier.color },
                    ]}
                  >
                    <Text style={styles.libraryBadgeText}>
                      {tier.label} • {tier.points} pts
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })
        )}
      </View>
    </>
  );
}

function AITab({
  description,
  setDescription,
  dares,
  generating,
  error,
  onGenerate,
  onPick,
}) {
  const hasDares = dares.length > 0;
  return (
    <>
      <Text style={styles.title}>Describe your friend</Text>
      <Text style={styles.subtitle}>
        I'll generate 3 dares tailored to them. Tap one to drop it into the
        Write tab.
      </Text>

      <Text style={styles.sectionLabel}>Describe your friend</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        placeholder="e.g. he hates running, she always brags about cooking"
        placeholderTextColor={colors.textMuted}
        style={[styles.input, styles.textarea]}
        multiline
        editable={!generating}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Pressable
        onPress={onGenerate}
        disabled={generating}
        style={({ pressed }) => [
          styles.submitButton,
          (generating || pressed) && styles.submitButtonPressed,
        ]}
      >
        {generating ? (
          <ActivityIndicator color={colors.background} />
        ) : (
          <Text style={styles.submitText}>
            {hasDares ? 'Regenerate' : 'Generate'}
          </Text>
        )}
      </Pressable>

      {hasDares && !generating ? (
        <View style={styles.libraryListWrap}>
          {dares.map((dare, idx) => {
            const tier = difficultyTierFor(dare.suggested_difficulty);
            return (
              <Pressable
                key={`${dare.title}-${idx}`}
                onPress={() => onPick(dare)}
                style={({ pressed }) => [
                  styles.libraryItem,
                  pressed && styles.libraryItemPressed,
                ]}
              >
                <Text style={styles.libraryTitle}>{dare.title}</Text>
                {dare.description ? (
                  <Text style={styles.libraryDescription} numberOfLines={3}>
                    {dare.description}
                  </Text>
                ) : null}
                {tier ? (
                  <View
                    style={[
                      styles.libraryBadge,
                      { backgroundColor: tier.color },
                    ]}
                  >
                    <Text style={styles.libraryBadgeText}>
                      {tier.label} • {tier.points} pts
                    </Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    marginTop: 16,
    textAlign: 'center',
  },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
    backgroundColor: colors.background,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: colors.accent },
  tabDisabled: { opacity: 0.5 },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  tabTextActive: { color: colors.dark },
  tabTextDisabled: { color: colors.textMuted },

  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.dark,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 8,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: 20,
    marginBottom: 8,
  },
  empty: { color: colors.textMuted, fontSize: 14 },

  input: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  textarea: { minHeight: 90, textAlignVertical: 'top' },
  helper: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'right',
  },

  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  chip: {
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    margin: 4,
  },
  chipSelected: { backgroundColor: colors.accent },
  chipText: { color: colors.text, fontSize: 14 },
  chipTextSelected: { color: colors.background, fontWeight: '600' },

  tierList: { marginTop: 4 },
  tier: {
    borderRadius: 12,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tierMain: { flex: 1 },
  tierLabel: { fontSize: 16, fontWeight: '700', color: colors.dark },
  tierMeta: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  tierTextOnFill: { color: colors.background },

  submitButton: {
    marginTop: 24,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonPressed: { opacity: 0.85 },
  submitText: { color: colors.background, fontSize: 16, fontWeight: '600' },

  libraryListWrap: { marginTop: 16 },
  libraryLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  libraryLoadingText: {
    marginLeft: 8,
    color: colors.textMuted,
    fontSize: 14,
  },
  libraryItem: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  libraryItemPressed: { opacity: 0.85 },
  libraryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  libraryDescription: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  libraryBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  libraryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.background,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
