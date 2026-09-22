import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Dimensions,
  Animated, PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, typography, spacing, radius, shadows } from '../src/theme';
import { useAuth } from '../src/store/auth';

const { width: SW } = Dimensions.get('window');

const LAYERS = [
  { key: 'satellite', label: 'Satellite', colors: ['#1a3a24', '#2e7d4a', '#0f2417'] },
  { key: 'ndvi',      label: 'NDVI',      colors: ['#3a1a00', '#d4a017', '#00c853'] },
  { key: 'moisture',  label: 'Moisture',  colors: ['#001a33', '#0066cc', '#00d4ff'] },
  { key: 'terrain',   label: 'Terrain',   colors: ['#2a1a0d', '#8a5a35', '#c68a5c'] },
];

const FIELDS = [
  { id: 'A', name: 'North Block',  crop: 'Maize',      health: 92, area: '4.2 ha', x: 0.08, y: 0.10, w: 0.38, h: 0.32 },
  { id: 'B', name: 'East Ridge',   crop: 'Cassava',    health: 78, area: '3.1 ha', x: 0.52, y: 0.10, w: 0.40, h: 0.32 },
  { id: 'C', name: 'South Field',  crop: 'Rice',       health: 45, area: '5.6 ha', x: 0.08, y: 0.48, w: 0.38, h: 0.38 },
  { id: 'D', name: 'West Garden',  crop: 'Tomato',     health: 88, area: '1.8 ha', x: 0.52, y: 0.48, w: 0.40, h: 0.38 },
];

function healthColor(h: number) {
  if (h >= 85) return '#00c853';
  if (h >= 70) return '#d4a017';
  if (h >= 50) return '#ff8a3d';
  return '#ff3b5c';
}

export default function FarmingMap() {
  const router = useRouter();
  const { palette, mode } = useTheme();
  const { scansRemaining } = useAuth();
  const styles = createStyles(palette);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [selected, setSelected] = useState(FIELDS[0]);

  // Pan animation for the map canvas
  const pan = useRef(new Animated.ValueXY()).current;
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 4 || Math.abs(g.dy) > 4,
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: () => {
        Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 6 }).start();
      },
    })
  ).current;

  const mapWidth  = SW - spacing.xl * 2;
  const mapHeight = mapWidth * 1.15;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={layer.colors as any}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* ── Top bar with BACK ── */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backIcon}>{'\u2039'}</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>

        <View style={styles.topCenter}>
          <Text style={styles.topKicker}>FARMING MAP</Text>
          <Text style={styles.topTitle}>{selected.name}</Text>
        </View>

        <View style={styles.scansPill}>
          <Text style={styles.scansText}>{scansRemaining}</Text>
        </View>
      </View>

      {/* ── Layer toggle ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.layerRow}
      >
        {LAYERS.map((l) => {
          const active = l.key === layer.key;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLayer(l)}
              style={[styles.layerChip, active && styles.layerChipActive]}
            >
              <View style={[styles.layerSwatch, { backgroundColor: l.colors[1] }]} />
              <Text style={[styles.layerText, active && styles.layerTextActive]}>
                {l.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Map canvas ── */}
      <View style={[styles.mapWrap, { width: mapWidth, height: mapHeight }]}>
        <Animated.View
          {...panResponder.panHandlers}
          style={[
            styles.mapCanvas,
            { transform: pan.getTranslateTransform() },
          ]}
        >
          {/* grid lines */}
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={'h' + i}
              style={[styles.gridH, { top: (i / 8) * mapHeight }]}
            />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <View
              key={'v' + i}
              style={[styles.gridV, { left: (i / 8) * mapWidth }]}
            />
          ))}

          {/* fields */}
          {FIELDS.map((f) => {
            const active = f.id === selected.id;
            const c = healthColor(f.health);
            return (
              <Pressable
                key={f.id}
                onPress={() => setSelected(f)}
                style={[
                  styles.field,
                  {
                    left: f.x * mapWidth,
                    top: f.y * mapHeight,
                    width: f.w * mapWidth,
                    height: f.h * mapHeight,
                    borderColor: c,
                    backgroundColor: c + (active ? '55' : '22'),
                  },
                  active && styles.fieldActive,
                ]}
              >
                <Text style={[styles.fieldId, { color: c }]}>{f.id}</Text>
                <Text style={styles.fieldCrop}>{f.crop}</Text>
                <Text style={[styles.fieldHealth, { color: c }]}>{f.health}%</Text>
              </Pressable>
            );
          })}

          {/* center crosshair */}
          <View
            style={[
              styles.crosshair,
              {
                left: mapWidth / 2 - 10,
                top: mapHeight / 2 - 10,
              },
            ]}
          >
            <View style={styles.crosshairDot} />
          </View>
        </Animated.View>

        {/* corner overlays */}
        <View style={styles.cornerTL}>
          <Text style={styles.cornerText}>N</Text>
        </View>
        <View style={styles.cornerTR}>
          <Text style={styles.cornerText}>{layer.label.toUpperCase()}</Text>
        </View>
        <View style={styles.cornerBR}>
          <Text style={styles.cornerText}>LIVE</Text>
        </View>
      </View>

      {/* ── Bottom sheet: selected field ── */}
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <View style={styles.sheetRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.sheetKicker}>FIELD {selected.id}</Text>
            <Text style={styles.sheetTitle}>{selected.name}</Text>
            <Text style={styles.sheetSub}>{selected.crop} • {selected.area}</Text>
          </View>
          <View
            style={[
              styles.healthBubble,
              { borderColor: healthColor(selected.health) },
            ]}
          >
            <Text style={[styles.healthValue, { color: healthColor(selected.health) }]}>
              {selected.health}
            </Text>
            <Text style={styles.healthLabel}>HEALTH</Text>
          </View>
        </View>

        <View style={styles.sheetStats}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>0.72</Text>
            <Text style={styles.statLbl}>NDVI</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>0.45</Text>
            <Text style={styles.statLbl}>MOISTURE</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>28°</Text>
            <Text style={styles.statLbl}>TEMP</Text>
          </View>
        </View>

        <View style={styles.sheetActions}>
          <Pressable
            onPress={() => router.push('/satellite' as any)}
            style={[styles.actionBtn, styles.actionPrimary]}
          >
            <Text style={styles.actionPrimaryText}>FULL SCAN</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(('/(tabs)/' + (selected.crop === 'Rice' ? 'crops' : 'crops')) as any)}
            style={[styles.actionBtn, styles.actionGhost]}
          >
            <Text style={styles.actionGhostText}>DIAGNOSE</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Add field FAB ── */}
      <Pressable onPress={() => {}} style={styles.fab}>
        <Text style={styles.fabIcon}>+</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },

  /* top bar */
  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md,
  },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingRight: 12,
  },
  backIcon: { fontSize: 28, fontWeight: '300', color: '#fff', marginTop: -3 },
  backText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#fff' },
  topCenter: { flex: 1, alignItems: 'center' },
  topKicker: { fontSize: 9, fontWeight: '800', letterSpacing: 2, color: 'rgba(255,255,255,0.6)' },
  topTitle: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.3, marginTop: 2 },
  scansPill: {
    minWidth: 40, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 999, backgroundColor: palette.neon,
  },
  scansText: { fontSize: 13, fontWeight: '900', color: palette.obsidian, textAlign: 'center' },

  /* layers */
  layerRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  layerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  layerChipActive: { backgroundColor: palette.neon, borderColor: palette.neon },
  layerSwatch: { width: 12, height: 12, borderRadius: 6 },
  layerText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  layerTextActive: { color: palette.obsidian },

  /* map */
  mapWrap: {
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(0,0,0,0.35)',
    ...shadows.neon,
  },
  mapCanvas: { flex: 1, position: 'relative' },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },

  field: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2,
    padding: 8,
    justifyContent: 'space-between',
  },
  fieldActive: {
    borderWidth: 3,
    shadowColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  fieldId: { fontSize: 16, fontWeight: '900' },
  fieldCrop: { fontSize: 11, fontWeight: '700', color: '#fff', marginTop: 2 },
  fieldHealth: { fontSize: 13, fontWeight: '900' },

  crosshair: { position: 'absolute', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  crosshairDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: palette.neon,
    shadowColor: palette.neon, shadowOpacity: 0.8, shadowRadius: 8, elevation: 4,
  },

  cornerTL: { position: 'absolute', top: 8, left: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  cornerTR: { position: 'absolute', top: 8, right: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  cornerBR: { position: 'absolute', bottom: 8, right: 10, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)' },
  cornerText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: '#fff' },

  /* bottom sheet */
  sheet: {
    position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 92,
    padding: spacing.xl, borderRadius: radius.xl,
    backgroundColor: palette.obsidian,
    borderWidth: 1, borderColor: palette.border,
    ...shadows.soft,
  },
  sheetHandle: {
    width: 44, height: 4, borderRadius: 2,
    backgroundColor: palette.border, alignSelf: 'center', marginBottom: spacing.md,
  },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  sheetKicker: { ...typography.micro, color: palette.textMuted },
  sheetTitle: { fontSize: 22, fontWeight: '900', color: palette.text, marginTop: 2, letterSpacing: -0.5 },
  sheetSub: { ...typography.caption, color: palette.textMuted, marginTop: 2 },
  healthBubble: {
    width: 68, height: 68, borderRadius: 34,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  healthValue: { fontSize: 20, fontWeight: '900' },
  healthLabel: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: palette.textMuted, marginTop: 1 },
  sheetStats: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  statBox: {
    flex: 1, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center',
  },
  statVal: { fontSize: 16, fontWeight: '900', color: palette.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: palette.textMuted, marginTop: 2 },
  sheetActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  actionBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
  actionPrimary: { backgroundColor: palette.neon },
  actionPrimaryText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: palette.obsidian },
  actionGhost: { borderWidth: 1.5, borderColor: palette.borderHi },
  actionGhostText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: palette.neon },

  /* FAB */
  fab: {
    position: 'absolute', right: spacing.xl, bottom: spacing.xl + 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: palette.neon,
    alignItems: 'center', justifyContent: 'center',
    ...shadows.neon,
  },
  fabIcon: { fontSize: 30, fontWeight: '300', color: palette.obsidian, marginTop: -3 },
});
