
// GAIA Design System — Obsidian Neon
export const palette = {
  // Core surfaces
  obsidian:    '#000000',
  abyss:       '#080c0a',
  surface:     'rgba(255, 255, 255, 0.03)',
  surfaceHi:   'rgba(255, 255, 255, 0.06)',
  border:      'rgba(0, 255, 136, 0.12)',
  borderHi:    'rgba(0, 255, 136, 0.28)',

  // Neon spectrum
  neon:        '#00ff88',
  neonDim:     '#00cc6a',
  neonGlow:    'rgba(0, 255, 136, 0.35)',
  neonSoft:    'rgba(0, 255, 136, 0.08)',

  // Panel accents
  crops:       '#00ff88',
  pests:       '#ff8a3d',
  soil:        '#c68a5c',
  livestock:   '#b47aff',
  danger:      '#ff3b5c',
  warning:     '#ffb830',

  // Text
  text:        '#ffffff',
  textMuted:   '#7a8884',
  textDim:     '#4a5350',

  // Gradients
  gradientDeep:  ['#000000', '#051410', '#000000'],
  gradientNeon:  ['#00ff88', '#00cc6a'],
  gradientCrops: ['#003a1f', '#00ff88'],
  gradientPests: ['#3a1a00', '#ff8a3d'],
  gradientSoil:  ['#2a1a0d', '#c68a5c'],
  gradientLive:  ['#1a0033', '#b47aff'],
};

export const typography = {
  hero:    { fontSize: 42, fontWeight: '900' as const, letterSpacing: -1.5 },
  title:   { fontSize: 32, fontWeight: '800' as const, letterSpacing: -1 },
  heading: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.5 },
  body:    { fontSize: 15, fontWeight: '500' as const },
  caption: { fontSize: 13, fontWeight: '500' as const, letterSpacing: 0.3 },
  micro:   { fontSize: 11, fontWeight: '600' as const, letterSpacing: 1.2 },
  mono:    { fontSize: 12, fontFamily: 'monospace', letterSpacing: 0.5 },
};

export const spacing = {
  xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48,
};

export const radius = {
  sm: 10, md: 16, lg: 22, xl: 28, full: 999,
};

export const shadows = {
  neon: {
    shadowColor: '#00ff88',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 24,
    elevation: 12,
  },
  soft: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
};
