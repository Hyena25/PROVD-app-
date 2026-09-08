import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Tabs, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radius, shadows, space } from '../../constants/theme';
import { listPendingVotesForUser } from '../../api/voteApi';

const ICONS = {
  index: ['home', 'home-outline'],
  groups: ['people', 'people-outline'],
  arena: ['flame', 'flame-outline'],
  votes: ['checkbox', 'checkbox-outline'],
  profile: ['person-circle', 'person-circle-outline'],
};

/**
 * Floating tab bar with five equal tabs. Compose is a FAB riding above the bar
 * rather than a sixth slot — with an odd number of tabs an inline button can't
 * sit on the centre line, and it would squeeze the labels.
 */
function TabBar({ state, descriptors, navigation, badges }) {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => ICONS[r.name]);

  const renderTab = (route) => {
    const index = state.routes.findIndex((r) => r.key === route.key);
    const focused = state.index === index;
    const [active, inactive] = ICONS[route.name];
    const badge = badges?.[route.name] ?? 0;

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        }}
        style={styles.tab}
        hitSlop={6}
      >
        <View>
          <Ionicons
            name={focused ? active : inactive}
            size={22}
            color={focused ? colors.ink : colors.muted}
          />
          {badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.tabLabel, focused && styles.tabLabelOn]}>
          {descriptors[route.key].options.title ?? route.name}
        </Text>
      </Pressable>
    );
  };

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      <Pressable
        onPress={() => router.push('/create-dare')}
        style={({ pressed }) => [styles.compose, pressed && styles.pressed]}
        hitSlop={8}
      >
        <Ionicons name="add" size={26} color="#FFFFFF" />
      </Pressable>

      <View style={styles.bar}>{routes.map(renderTab)}</View>
    </View>
  );
}

export default function TabsLayout() {
  const [badges, setBadges] = useState({ votes: 0 });

  const refresh = useCallback(async () => {
    try {
      const votes = await listPendingVotesForUser();
      setBadges({ votes: Array.isArray(votes) ? votes.length : 0 });
    } catch {
      // badge is decorative — never block the tab bar on it
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} badges={badges} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="arena" options={{ title: 'Arena' }} />
      <Tabs.Screen name="votes" options={{ title: 'Votes' }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    ...shadows.card,
    shadowOpacity: 0.1,
    shadowRadius: 24,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tabLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 10,
    color: colors.muted,
  },
  tabLabelOn: { color: colors.ink, fontFamily: fonts.sansBold },

  compose: {
    alignSelf: 'flex-end',
    marginRight: space.sm,
    marginBottom: space.md,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.button,
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  pressed: { opacity: 0.75 },

  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontFamily: fonts.sansBold, fontSize: 9.5, color: '#FFFFFF' },
});
