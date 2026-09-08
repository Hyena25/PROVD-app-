// Shared UI primitives for the "soft card" system.
//
// Pages are a gradient wash; everything readable lives inside a white <Card />
// with a big radius and a soft shadow. Colour appears in small saturated
// blocks — <Pill />, a lime or navy card, the accent <Button /> — never as a
// wash behind body copy.

import { forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
  colors,
  fonts,
  gradient,
  gutter,
  radius,
  shadows,
  space,
  type,
} from '../constants/theme';

/** Gradient page + correct insets on both platforms. */
export function Screen({ children, style, edges }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={gradient}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={[styles.safe, style]} edges={edges}>
        {children}
      </SafeAreaView>
    </View>
  );
}

/** White card. `tone` swaps it to the lime highlight or the inverted navy. */
export function Card({ children, tone = 'white', style, onPress }) {
  const body = (
    <View
      style={[
        styles.card,
        tone === 'plain' && styles.cardPlain,
        tone === 'lime' && styles.cardLime,
        tone === 'navy' && styles.cardNavy,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {body}
    </Pressable>
  );
}

/** Circular icon button — the round chips in the top bar. */
export function IconButton({ glyph, onPress, tone = 'white', badge, style }) {
  const onDark = tone === 'navy' || tone === 'accent';
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        tone === 'navy' && styles.iconBtnNavy,
        tone === 'accent' && styles.iconBtnAccent,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.iconGlyph, onDark && styles.iconGlyphOnDark]}>
        {glyph}
      </Text>
      {badge ? <View style={styles.iconBadge} /> : null}
    </Pressable>
  );
}

/** Top bar: circular back on the left, optional circular actions on the right. */
export function TopBar({ right = null, onBack, title }) {
  return (
    <View style={styles.topBar}>
      <IconButton glyph="←" onPress={onBack ?? (() => router.back())} />
      {title ? <Text style={styles.topTitle}>{title}</Text> : <View />}
      <View style={styles.topRight}>{right}</View>
    </View>
  );
}

/** Heading that sits on the gradient between cards. */
export function SectionTitle({ children, right, style }) {
  return (
    <View style={[styles.sectionRow, style]}>
      <Text style={type.section}>{children}</Text>
      {right}
    </View>
  );
}

/** Small saturated status pill. */
export function Pill({ children, tone = 'neutral', style }) {
  return (
    <View style={[styles.pill, PILL_BG[tone], style]}>
      <Text style={[styles.pillText, PILL_FG[tone]]}>{children}</Text>
    </View>
  );
}

const PILL_BG = {
  neutral: { backgroundColor: colors.surface },
  accent: { backgroundColor: colors.accent },
  success: { backgroundColor: colors.successSoft },
  danger: { backgroundColor: colors.dangerSoft },
  warn: { backgroundColor: colors.warnSoft },
  lime: { backgroundColor: colors.lime },
};

const PILL_FG = {
  neutral: { color: colors.muted },
  accent: { color: '#FFFFFF' },
  success: { color: colors.success },
  danger: { color: colors.danger },
  warn: { color: '#8A6100' },
  lime: { color: colors.limeInk },
};

/** Pill-shaped action. Primary = accent, dark = navy, secondary = outline. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}) {
  const off = disabled || loading;
  const onDark = variant === 'primary' || variant === 'dark';
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'dark' && styles.btnDark,
        variant === 'secondary' && styles.btnSecondary,
        variant === 'ghost' && styles.btnGhost,
        off && styles.btnOff,
        pressed && !off && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={onDark ? '#FFFFFF' : colors.ink} />
      ) : (
        <Text
          style={[
            styles.btnText,
            onDark && styles.btnTextOnDark,
            variant === 'ghost' && styles.btnTextGhost,
          ]}
        >
          {title}
        </Text>
      )}
    </Pressable>
  );
}

/** Labelled input. Lives inside a card, so its fill is the neutral surface. */
export const Field = forwardRef(function Field(
  { label, hint, error, style, inputStyle, ...props },
  ref
) {
  return (
    <View style={[styles.fieldWrap, style]}>
      {label ? (
        <Text style={[type.label, styles.fieldLabel]}>{label}</Text>
      ) : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.muted}
        style={[styles.input, error && styles.inputError, inputStyle]}
        {...props}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
});

/** Value over a caption — the stat blocks inside cards. */
export function Stat({ value, label, tone, style }) {
  const dark = tone === 'onDark';
  return (
    <View style={style}>
      <Text style={[type.numeral, dark && styles.onDark]}>{value}</Text>
      <Text style={[type.label, dark && styles.onDarkMuted]}>{label}</Text>
    </View>
  );
}

/** Multi-segment progress bar. `segments` = [{ flex, color }]. */
export function SegmentBar({ segments, style }) {
  return (
    <View style={[styles.segBar, style]}>
      {segments.map((s, i) => (
        <View
          key={i}
          style={{ flex: Math.max(s.flex, 0.0001), backgroundColor: s.color }}
        />
      ))}
    </View>
  );
}

export function Empty({ children, style }) {
  return <Text style={[styles.empty, style]}>{children}</Text>;
}

export function Loading() {
  return (
    <Screen>
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    </Screen>
  );
}

export function ErrorState({ message, onRetry, back = true }) {
  return (
    <Screen>
      {back ? <TopBar /> : null}
      <View style={styles.center}>
        <Card style={styles.errorCard}>
          <Text style={styles.errorMsg}>{message}</Text>
          {onRetry ? (
            <Button title="Try again" onPress={onRetry} style={styles.retry} />
          ) : null}
        </Card>
      </View>
    </Screen>
  );
}

export const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgMid },
  safe: { flex: 1 },

  card: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.xl,
    ...shadows.card,
  },
  cardPlain: { borderWidth: 1, borderColor: colors.line },
  cardLime: { backgroundColor: colors.lime },
  cardNavy: { backgroundColor: colors.navy },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  topRight: { flexDirection: 'row', gap: space.sm },
  topTitle: { fontFamily: fonts.sansBold, fontSize: 16, color: colors.ink },

  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.card,
  },
  iconBtnNavy: { backgroundColor: colors.navy },
  iconBtnAccent: { backgroundColor: colors.accent },
  iconGlyph: {
    fontFamily: fonts.sansMedium,
    fontSize: 18,
    lineHeight: 22,
    color: colors.ink,
  },
  iconGlyphOnDark: { color: '#FFFFFF' },
  iconBadge: {
    position: 'absolute',
    top: 9,
    right: 9,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },

  pill: {
    paddingHorizontal: space.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillText: { fontFamily: fonts.sansMedium, fontSize: 12 },

  btn: {
    borderRadius: radius.pill,
    paddingVertical: 15,
    paddingHorizontal: space.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.accent, ...shadows.button },
  btnDark: { backgroundColor: colors.navy, ...shadows.button },
  btnSecondary: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.line,
  },
  btnGhost: { backgroundColor: 'transparent', paddingVertical: space.sm },
  btnOff: { opacity: 0.4 },
  btnText: { fontFamily: fonts.sansBold, fontSize: 15, color: colors.ink },
  btnTextOnDark: { color: '#FFFFFF' },
  btnTextGhost: { color: colors.muted, fontFamily: fonts.sansMedium },

  pressed: { opacity: 0.65 },

  fieldWrap: { marginBottom: space.lg },
  fieldLabel: { marginBottom: space.sm },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: fonts.sans,
    color: colors.ink,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    marginTop: space.sm,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.danger,
  },
  fieldHint: {
    marginTop: space.sm,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    color: colors.muted,
  },

  onDark: { color: '#FFFFFF' },
  onDarkMuted: { color: 'rgba(255,255,255,0.6)' },

  segBar: {
    flexDirection: 'row',
    height: 7,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    gap: 2,
  },

  empty: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: gutter,
  },
  errorCard: { alignSelf: 'stretch', alignItems: 'center' },
  errorMsg: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    textAlign: 'center',
  },
  retry: { marginTop: space.lg, alignSelf: 'stretch' },
});
