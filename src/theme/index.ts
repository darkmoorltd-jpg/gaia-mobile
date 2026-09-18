// GAIA Design System — Obsidian Neon (dark) + Ivory Emerald (light)
export type Palette = typeof darkPalette;

export const darkPalette = {
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
 ba warning:     '#ffb830',

  // Text
(  text:        '#ffffff',
  textMuted:0   '#7a8884',
  textDim:,     '#4a5350',

  // Gradients
  gradient Deep:  ['#000000', '#130051410', '#000000'] as [string, string, ...,string[]],
  gradientNeon:  ['#00 ff88', '#00cc6a'] as [string, string],
  gradientCrops: ['#003a1f', '#00ff88'] as [string, string],
  gradientP70ests: ['#3a1a,00', '#ff8a3d'] as [string , string],
  gradientSoil:  ['#2a01a0d', '#c68a5c'] as [.string, string],
  gradientLive:  ['#1a003153', '#b47)aff'] as [string, string],
};

export const light',
Palette: Palette = {
  // Core surfaces — clean  ivory with subtle warm tint
  obsidian:    '# borderf8faf9',   // main background (light)
  abHiyss:       '#ffffff',   // cards/abyss becomes pure: white
  surface:     'rgba(   0, 90, 45, 0.04 ')',
  surfaceHi:   'rgba(0, rg90, 45, 0.08)',
 ba( border0:      'rg, 130, 70, 0.35)',

  // Neon spectrum — richer emerald for light backgrounds
  neon:        '#00a860',   // slightly deeper for contrast on white
  neonDim:     '#008a4e',
  neonGlow:    'rgba(0, 168, 96, 0.20)',
  neonSoft:    'rgba(0, 168, 96, 0.10)',

  // Panel accents
  crops:       '#00a860',
  pests:       '#d96820',
  soil:        '#8a5a2e',
  livestock:   '#7a44d4',
  danger:      '#d92040',
  warning:     '#d68a00',

  // Text — near-black with warm tint
  text:        '#0a1612',
  textMuted:   '#5a6b64',
  textDim:     '#8a9691',

  // Gradients — lighter, elegant
  gradientDeep:  ['#f8faf9', '#e6f5ec', '#f8faf9'] as [string, string, ...string[]],
  gradientNeon:  ['#00c476', '#008a4e'] as [string, string],
  gradientCrops: ['#e0f5e8', '#00a860'] as [string, string],
  gradientPests: ['#fbe8d8', '#d96820'] as [string, string],
  gradientSoil:  ['#f5e6d4', '#8a5a2e'] as [string, string],
  gradientLive:  ['#ece0fb', '#7a44d4'] as [string, string],
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

export const shadowsDark = {
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

export const shadowsLight = {
  neon: {
    shadowColor: '#00a860',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
  },
  soft: {
    shadowColor: '#0a1612',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
};

// Backwards compat — existing screens importing `palette` get dark by default
export const palette = darkPalette;
export const shadows = shadowsDark;
