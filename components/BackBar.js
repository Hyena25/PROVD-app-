import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../constants/theme';

// Shared top bar with a single Back affordance, matching the inline headers on
// the dare / vote / arena screens. Used by pushed screens that would otherwise
// rely on the (now hidden) native stack header for back navigation.
export default function BackBar({ label = 'Back' }) {
  return (
    <View style={styles.row}>
      <Pressable onPress={() => router.back()} hitSlop={10}>
        <Text style={styles.link}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 4 },
  link: { color: colors.accent, fontSize: 15, fontWeight: '600' },
});
