import { useCallback, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { colors, fonts, gutter, space, type } from '../../constants/theme';
import { listMyGroups } from '../../api/groupApi';
import {
  Button,
  Card,
  Empty,
  ErrorState,
  IconButton,
  Loading,
  Pill,
  Screen,
} from '../../components/ui';

export default function Groups() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [groups, setGroups] = useState([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setGroups((await listMyGroups()) ?? []);
    } catch (err) {
      setError(err?.message ?? 'Could not load your groups.');
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
        <Text style={styles.title}>Groups</Text>
        <View style={styles.headActions}>
          <IconButton glyph="⌕" onPress={() => router.push('/join-group')} />
          <IconButton
            glyph="+"
            tone="navy"
            onPress={() => router.push('/create-group')}
          />
        </View>
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
        {groups.length === 0 ? (
          <Card>
            <Text style={styles.emptyTitle}>No groups yet</Text>
            <Empty>
              Groups are where you dare your friends and chase the monthly
              crown. Start one, or join with a code.
            </Empty>
            <Button
              title="Create a group"
              onPress={() => router.push('/create-group')}
              style={styles.emptyCta}
            />
            <Button
              title="I have an invite code"
              variant="secondary"
              onPress={() => router.push('/join-group')}
              style={styles.emptySecondary}
            />
          </Card>
        ) : (
          groups.map((g, i) => (
            <Card
              key={g.id}
              tone={i === 0 ? 'navy' : 'white'}
              style={styles.groupCard}
              onPress={() => router.push(`/group/${g.id}`)}
            >
              <View style={styles.groupTop}>
                <Text style={[styles.groupName, i === 0 && styles.onDark]}>
                  {g.name}
                </Text>
                <Pill tone={i === 0 ? 'lime' : 'neutral'}>
                  {g.member_count} members
                </Pill>
              </View>
              <Text style={[styles.groupMeta, i === 0 && styles.onDarkMuted]}>
                Tap to see standings and send a dare
              </Text>
            </Card>
          ))
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  title: { ...type.display, fontSize: 32, lineHeight: 38 },
  headActions: { flexDirection: 'row', gap: space.sm },

  scroll: { paddingHorizontal: gutter, paddingBottom: 120 },

  emptyTitle: {
    fontFamily: fonts.sansBold,
    fontSize: 18,
    color: colors.ink,
    marginBottom: space.xs,
  },
  emptyCta: { marginTop: space.xl },
  emptySecondary: { marginTop: space.sm },

  groupCard: { marginBottom: space.md },
  groupTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  groupName: {
    flex: 1,
    fontFamily: fonts.sansBold,
    fontSize: 19,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  groupMeta: { ...type.small, marginTop: space.sm },

  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,0.6)' },
});
