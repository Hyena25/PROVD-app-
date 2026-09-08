import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { supabase } from '../lib/supabase';
import { colors, fonts, gutter, radius, space, type } from '../constants/theme';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  Field,
  Loading,
  Pill,
  Screen,
  TopBar,
} from '../components/ui';
import {
  CATEGORIES,
  DIFFICULTY_TIERS,
  createDare,
  fetchDareLibrary,
} from '../api/dareApi';
import { generateDares } from '../api/aiApi';
import { listMyGroups } from '../api/groupApi';

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

  const [resolvedGroupId, setResolvedGroupId] = useState(groupId ?? null);

  // The compose button in the tab bar opens this screen with no groupId, so
  // fall back to the user's first group instead of dead-ending.
  useEffect(() => {
    if (groupId) {
      setResolvedGroupId(groupId);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mine = await listMyGroups();
        if (cancelled) return;
        if (mine?.length) {
          setResolvedGroupId(mine[0].id);
        } else {
          setLoadingMembers(false);
          setLoadError('Join or create a group first — dares go to a group.');
        }
      } catch (err) {
        if (!cancelled) {
          setLoadingMembers(false);
          setLoadError(err?.message ?? 'Could not load your groups.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [groupId]);

  useEffect(() => {
    if (!resolvedGroupId) return;

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
          { p_group_id: resolvedGroupId }
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
  }, [resolvedGroupId]);

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
        groupId: resolvedGroupId,
      });
      router.replace(`/group/${resolvedGroupId}`);
    } catch (err) {
      setSubmitError(err?.message ?? 'Could not create the dare. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingMembers) return <Loading />;
  if (loadError) return <ErrorState message={loadError} />;

  return (
    <Screen>
      <TopBar />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.tabWrap}>
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable
                key={tab.key}
                onPress={() => !tab.disabled && setActiveTab(tab.key)}
                disabled={tab.disabled}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text
                  numberOfLines={1}
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
          showsVerticalScrollIndicator={false}
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
    </Screen>
  );
}

/** Selectable pill used for targets and categories. */
function SelectChip({ label, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.selChip,
        selected && styles.selChipOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.selChipText, selected && styles.selChipTextOn]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Difficulty row: a colour dot carries the tier so the row stays quiet. */
function TierRow({ tier, selected, onPress, last }) {
  const tone = colors[tier.key] ?? colors.muted;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tier,
        !last && styles.tierDivided,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.tierDot, { backgroundColor: tone }]} />
      <View style={styles.tierMain}>
        <Text style={styles.tierLabel}>{tier.label}</Text>
        <Text style={styles.tierMeta}>
          {tier.points} pts · {tier.hours}h window
        </Text>
      </View>
      <View style={[styles.radio, selected && { borderColor: tone }]}>
        {selected ? (
          <View style={[styles.radioDot, { backgroundColor: tone }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

/** Tappable suggestion used by both the library and AI tabs. */
function SuggestionRow({ item, onPick }) {
  const tier = difficultyTierFor(item.suggested_difficulty);
  return (
    <Card style={styles.suggestion} onPress={() => onPick(item)}>
      <View style={styles.suggestionTop}>
        <Text style={styles.suggestionTitle}>{item.title}</Text>
        {tier ? (
          <Text
            style={[
              styles.suggestionTier,
              { color: colors[tier.key] ?? colors.muted },
            ]}
          >
            {tier.points} pts
          </Text>
        ) : null}
      </View>
      {item.description ? (
        <Text style={styles.suggestionBody} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
    </Card>
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
      <Text style={styles.h1}>New dare</Text>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>Who gets it</Text>
        {members.length === 0 ? (
          <Empty>No other members in this group yet.</Empty>
        ) : (
          <View style={styles.chipRow}>
            {members.map((m) => (
              <SelectChip
                key={m.user_id}
                label={m.display_name?.trim() || `@${m.username}`}
                selected={targetUserId === m.user_id}
                onPress={() => setTargetUserId(m.user_id)}
              />
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>The dare</Text>
        <Field
          value={title}
          onChangeText={setTitle}
          placeholder="Run a mile in under 8 minutes"
          maxLength={MAX_TITLE_LENGTH}
          editable={!submitting}
          hint={`${title.length}/${MAX_TITLE_LENGTH}`}
        />
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="Any rules or context (optional)"
          multiline
          editable={!submitting}
          inputStyle={styles.textarea}
          style={styles.lastField}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <SelectChip
              key={c.key}
              label={c.label}
              selected={category === c.key}
              onPress={() => setCategory(c.key)}
            />
          ))}
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>Difficulty</Text>
        {DIFFICULTY_TIERS.map((t, i) => (
          <TierRow
            key={t.key}
            tier={t}
            selected={difficulty === t.key}
            onPress={() => setDifficulty(t.key)}
            last={i === DIFFICULTY_TIERS.length - 1}
          />
        ))}
      </Card>

      {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

      <Button
        title="Send dare"
        onPress={onSubmit}
        loading={submitting}
        style={styles.submit}
      />
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
      <Text style={styles.h1}>Pick a dare</Text>
      <Text style={styles.sub}>
        Tap one to drop it into Write. You can edit before sending.
      </Text>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>Category</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <SelectChip
              key={c.key}
              label={c.label}
              selected={libraryCategory === c.key}
              onPress={() => setLibraryCategory(c.key)}
            />
          ))}
        </View>
      </Card>

      {loading ? (
        <Card style={styles.card}>
          <View style={styles.loadRow}>
            <ActivityIndicator color={colors.accent} size="small" />
            <Text style={styles.loadText}>Loading dares…</Text>
          </View>
        </Card>
      ) : error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : items.length === 0 ? (
        <Card style={styles.card}>
          <Empty>No dares in this category yet.</Empty>
        </Card>
      ) : (
        items.map((item) => (
          <SuggestionRow key={item.id} item={item} onPick={onPick} />
        ))
      )}
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
      <Text style={styles.h1}>Make it personal</Text>
      <Text style={styles.sub}>
        Describe your friend and I{'\u2019'}ll write three dares aimed squarely
        at them.
      </Text>

      <Card style={styles.card}>
        <Text style={[type.label, styles.cardLabel]}>About them</Text>
        <Field
          value={description}
          onChangeText={setDescription}
          placeholder="e.g. he hates running, she brags about her cooking"
          multiline
          editable={!generating}
          inputStyle={styles.textarea}
        />
        <Button
          title={hasDares ? 'Regenerate' : 'Generate dares'}
          onPress={onGenerate}
          loading={generating}
        />
      </Card>

      {error ? (
        <Card style={styles.card}>
          <Text style={styles.error}>{error}</Text>
        </Card>
      ) : null}

      {hasDares && !generating
        ? dares.map((dare, i) => (
            <SuggestionRow
              key={`${dare.title}-${i}`}
              item={dare}
              onPick={onPick}
            />
          ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { paddingHorizontal: gutter, paddingBottom: space.xxxl },

  tabWrap: {
    flexDirection: 'row',
    marginHorizontal: gutter,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: radius.pill,
    padding: 4,
    marginBottom: space.lg,
  },
  tab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.pill,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: colors.navy },
  tabText: { fontFamily: fonts.sansMedium, fontSize: 12.5, color: colors.muted },
  tabTextActive: { color: '#FFFFFF', fontFamily: fonts.sansBold },
  tabTextDisabled: { opacity: 0.4 },

  h1: { ...type.display, fontSize: 30, lineHeight: 36 },
  sub: { ...type.bodyMuted, marginTop: space.xs },

  card: { marginTop: space.md },
  cardLabel: { marginBottom: space.md },
  lastField: { marginBottom: 0 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  selChip: {
    paddingHorizontal: space.lg,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  selChipOn: { backgroundColor: colors.navy },
  selChipText: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.inkSoft,
  },
  selChipTextOn: { color: '#FFFFFF', fontFamily: fonts.sansBold },

  textarea: { minHeight: 88, textAlignVertical: 'top', paddingTop: 14 },

  tier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
  },
  tierDivided: { borderBottomWidth: 1, borderBottomColor: colors.line },
  tierDot: { width: 10, height: 10, borderRadius: 5 },
  tierMain: { flex: 1 },
  tierLabel: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  tierMeta: { ...type.small, marginTop: 1 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5 },

  loadRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  loadText: { ...type.small },

  suggestion: { marginTop: space.md },
  suggestionTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.md,
  },
  suggestionTitle: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 15,
    lineHeight: 21,
    color: colors.ink,
  },
  suggestionTier: { fontFamily: fonts.sansBold, fontSize: 13 },
  suggestionBody: { ...type.small, marginTop: space.xs },

  error: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
    marginTop: space.md,
  },
  submit: { marginTop: space.xl },

  pressed: { opacity: 0.65 },
});
