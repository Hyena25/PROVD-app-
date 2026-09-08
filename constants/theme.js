// Provd design tokens — "soft card" system.
//
// The look: a warm cream→periwinkle gradient page, white cards with big radii
// floating on top, bold grotesk headlines, and colour used in small saturated
// blocks (status pills, one lime highlight card, the accent CTA).

export const colors = {
  ink: '#14151A', // headlines, primary type
  inkSoft: '#3D4048', // body copy on white
  muted: '#8A8F98', // secondary type, metadata

  card: '#FFFFFF', // every card sits on pure white
  surface: '#F4F5F7', // inputs and inert fills inside cards
  line: '#ECEDF1', // hairlines inside cards

  // Page gradient stops (top → bottom).
  bgTop: '#F8EFE7',
  bgMid: '#F0EEF5',
  bgBottom: '#DFE4F3',

  accent: '#FF4757', // primary action / brand coral
  accentSoft: '#FFE7E9',

  lime: '#D6F24E', // the one high-energy highlight block
  limeInk: '#26310A',

  navy: '#16181D', // inverted card
  navyInk: '#FFFFFF',

  success: '#0E9F6E',
  successSoft: '#D3F2E3',
  danger: '#E5484D',
  dangerSoft: '#FDE4E5',
  warn: '#E8A317',
  warnSoft: '#FCF0D6',

  // Difficulty ramp.
  easy: '#0E9F6E',
  medium: '#E8A317',
  hard: '#F76B15',
  insane: '#7C4DFF',

  // Back-compat aliases.
  paper: '#F0EEF5',
  background: '#FFFFFF',
  dark: '#14151A',
  text: '#14151A',
  textMuted: '#8A8F98',
};

export const gradient = [colors.bgTop, colors.bgMid, colors.bgBottom];

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  xxxl: 40,
};

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  card: 26,
  pill: 999,
};

export const gutter = 18;

export const fonts = {
  sans: 'SpaceGrotesk_400Regular',
  sansMedium: 'SpaceGrotesk_500Medium',
  sansBold: 'SpaceGrotesk_700Bold',
  // Kept registered for the wordmark; the UI itself is all grotesk now.
  serif: 'InstrumentSerif_400Regular',
  serifItalic: 'InstrumentSerif_400Regular_Italic',
};

export const type = {
  // Big, bold, tight — the headline voice.
  display: {
    fontFamily: fonts.sansBold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.2,
    color: colors.ink,
  },
  h1: {
    fontFamily: fonts.sansBold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.8,
    color: colors.ink,
  },
  h2: {
    fontFamily: fonts.sansBold,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.3,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
  },
  bodyMuted: {
    fontFamily: fonts.sans,
    fontSize: 14,
    lineHeight: 21,
    color: colors.muted,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.muted,
  },
  // Quiet caption above a value inside a card.
  label: {
    fontFamily: fonts.sansMedium,
    fontSize: 12,
    lineHeight: 16,
    color: colors.muted,
  },
  // Section heading between cards.
  section: {
    fontFamily: fonts.sansBold,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: colors.ink,
  },
  numeral: {
    fontFamily: fonts.sansBold,
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.6,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  mono: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
};

// Soft and wide — cards lift gently off the gradient, never hard-edged.
export const shadows = {
  none: {},
  card: {
    shadowColor: '#1B1D2A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
  button: {
    shadowColor: '#1B1D2A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 4,
  },
};
