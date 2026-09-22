import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Alert, ActivityIndicator,
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import * as turf from '@turf/turf';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Polygon, Polyline, Circle, Line as SvgLine } from 'react-native-svg';
import { useTheme, spacing, radius, typography, shadows } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const { width: SW } = Dimensions.get('window');

const LAYERS = [
  { key: 'satellite', label: 'Satellite', top: '#0a2016', mid: '#1a4d2e', bottom: '#050d08' },
  { key: 'terrain',   label: 'Terrain',   top: '#1a1008', mid: '#3d2817', bottom: '#0a0604' },
  { key: 'street',    label: 'Street',    top: '#141414', mid: '#262626', bottom: '#0a0a0a' },
  { key: 'dark',      label: 'Dark',      top: '#000000', mid: '#0a0a0a', bottom: '#000000' },
];

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);

  const [points, setPoints] = useState<{lat: number; lon: number}[]>([]);
  const [areaM2, setAreaM2] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [currentPos, setCurrentPos] = useState<{lat: number; lon: number} | null>(null);
  const [maps, setMaps] = useState<any[]>([]);
  const [layer, setLayer] = useState(LAYERS[0]);
  const [busy, setBusy] = useState(false);
  const [permErr, setPermErr] = useState<string | null>(null);
  const locationSub = useRef<any>(null);

  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setPermErr('Location permission required');
          return;
        }
        loadMaps();
        const last = await Location.getLastKnownPositionAsync();
        if (last) {
          setCurrentPos({ lat: last.coords.latitude, lon: last.coords.longitude });
        }
      } catch (e: any) {
        setPermErr(e?.message || 'Location unavailable');
      }
    })();
    return () => {
      if (locationSub.current) locationSub.current.remove();
    };
  }, []);

  const loadMaps = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('farm_maps')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setMaps(data || []);
    } catch {}
  };

  const startTracking = async () => {
    setPoints([]);
    setAreaM2(0);
    setTracking(true);
    try {
      locationSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 3 },
        (loc) => {
          const p = { lat: loc.coords.latitude, lon: loc.coords.longitude };
          setCurrentPos(p);
          setPoints((prev) => {
            const next = [...prev, p];
            if (next.length >= 3) {
              try {
                const poly = turf.polygon([[
                  ...next.map((x) => [x.lon, x.lat]),
                  [next[0].lon, next[0].lat],
                ]]);
                setAreaM2(turf.area(poly));
              } catch {}
            }
            return next;
          });
        }
      );
    } catch (e: any) {
      Alert.alert('GPS error', e?.message || 'Try again');
      setTracking(false);
    }
  };

  const stopTracking = async () => {
    if (locationSub.current) {
      locationSub.current.remove();
      locationSub.current = null;
    }
    setTracking(false);
    if (points.length >= 3) {
      await saveMap();
    } else {
      Alert.alert('Not enough points', 'Walk a wider perimeter and try again.');
    }
  };

  const saveMap = async () => {
    if (!user) return;
    setBusy(true);
    try {
      const a = areaM2 / 4046.86;
      await supabase.from('farm_maps').insert({
        user_id: user.id,
        boundary: JSON.stringify(points),
        area_sqm: areaM2,
        area_acres: a,
        label: 'Field ' + new Date().toLocaleDateString(),
      });
      await loadMaps();
      Alert.alert('Saved', `${a.toFixed(2)} acres mapped`);
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  // ── Project lat/lon into SVG viewport coordinates ──
  const canvasW = SW - spacing.xl * 2;
  const canvasH = 320;

  const project = (pts: {lat: number; lon: number}[]) => {
    if (pts.length === 0) return [];
    const all = currentPos ? [...pts, currentPos] : pts;
    const lats = all.map((p) => p.lat);
    const lons = all.map((p) => p.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const spanLat = maxLat - minLat || 0.0001;
    const spanLon = maxLon - minLon || 0.0001;
    const pad = 30;
    return all.map((p) => ({
      x: pad + ((p.lon - minLon) / spanLon) * (canvasW - pad * 2),
      y: canvasH - pad - ((p.lat - minLat) / spanLat) * (canvasH - pad * 2),
    }));
  };

  const projected = project(points);
  const currentProjected = currentPos
    ? project([currentPos])[project([currentPos]).length - 1]
    : null;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[layer.top, layer.mid, layer.bottom] as any}
        style={StyleSheet.absoluteFill}
      />

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backIcon}>‹</Text>
          <Text style={styles.backText}>BACK</Text>
        </Pressable>
        <View style={styles.topCenter}>
          <Text style={styles.topKicker}>FARM MAPPING</Text>
          <Text style={styles.topTitle}>
            {tracking ? 'Recording…' : points.length >= 3 ? acres.toFixed(2) + ' acres' : 'Walk the perimeter'}
          </Text>
        </View>
        <View style={[styles.livePill, tracking && styles.livePillActive]}>
          <View style={[styles.liveDot, tracking && { backgroundColor: palette.danger }]} />
          <Text style={styles.liveText}>{tracking ? 'REC' : 'IDLE'}</Text>
        </View>
      </View>

      {/* LAYER CHIPS */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
        {LAYERS.map((l) => {
          const active = l.key === layer.key;
          return (
            <Pressable
              key={l.key}
              onPress={() => setLayer(l)}
              style={[styles.layerChip, active && styles.layerChipActive]}
            >
              <View style={[styles.swatch, { backgroundColor: l.mid }]} />
              <Text style={[styles.layerText, active && styles.layerTextActive]}>{l.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* MAP CANVAS (SVG) */}
      <View style={[styles.mapWrap, { width: canvasW, height: canvasH }]}>
        <Svg width={canvasW} height={canvasH}>
          {/* grid */}
          {Array.from({ length: 9 }).map((_, i) => (
            <SvgLine
              key={'h' + i}
              x1={0} y1={(i / 8) * canvasH}
              x2={canvasW} y2={(i / 8) * canvasH}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
          ))}
          {Array.from({ length: 9 }).map((_, i) => (
            <SvgLine
              key={'v' + i}
              x1={(i / 8) * canvasW} y1={0}
              x2={(i / 8) * canvasW} y2={canvasH}
              stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            />
          ))}

          {/* polygon fill (when 3+ points) */}
          {projected.length >= 3 && (
            <Polygon
              points={projected.map((p) => `${p.x},${p.y}`).join(' ')}
              fill={palette.neon}
              fillOpacity={0.18}
              stroke={palette.neon}
              strokeWidth={3}
            />
          )}

          {/* polyline while walking */}
          {projected.length >= 2 && (
            <Polyline
              points={projected.map((p) => `${p.x},${p.y}`).join(' ')}
              fill="none"
              stroke={palette.neon}
              strokeWidth={2}
              strokeOpacity={0.9}
            />
          )}

          {/* breadcrumb dots */}
          {projected.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill={palette.neon} opacity={0.6} />
          ))}

          {/* current position — outer glow + inner dot */}
          {currentProjected && (
            <>
              <Circle
                cx={currentProjected.x} cy={currentProjected.y}
                r={14} fill={palette.neon} fillOpacity={0.18}
              />
              <Circle
                cx={currentProjected.x} cy={currentProjected.y}
                r={8} fill={palette.neon} fillOpacity={0.4}
              />
              <Circle
                cx={currentProjected.x} cy={currentProjected.y}
                r={5} fill={palette.neon}
              />
            </>
          )}
        </Svg>

        {/* Neon corner frame */}
        <View pointerEvents="none" style={styles.frame}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        {/* Empty state */}
        {!currentPos && !permErr && (
          <View style={styles.centerOverlay}>
            <ActivityIndicator color={palette.neon} />
            <Text style={styles.loadingText}>ACQUIRING GPS…</Text>
          </View>
        )}
        {permErr && (
          <View style={styles.centerOverlay}>
            <Text style={styles.errorText}>⚠ {permErr}</Text>
          </View>
        )}

        {/* Coordinate badge */}
        {currentPos && (
          <View style={styles.coordBadge}>
            <Text style={styles.coordText}>
              {currentPos.lat.toFixed(5)}, {currentPos.lon.toFixed(5)}
            </Text>
          </View>
        )}

        {/* Layer name overlay */}
        <View style={styles.layerBadge}>
          <Text style={styles.layerBadgeText}>{layer.label.toUpperCase()}</Text>
        </View>
      </View>

      {/* STATS */}
      <View style={styles.statRow}>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{acres.toFixed(2)}</Text>
          <Text style={styles.statLbl}>ACRES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{hectares.toFixed(2)}</Text>
          <Text style={styles.statLbl}>HECTARES</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statVal}>{points.length}</Text>
          <Text style={styles.statLbl}>POINTS</Text>
        </View>
      </View>

      {/* CTA */}
      <Pressable
        onPress={tracking ? stopTracking : startTracking}
        disabled={busy || !!permErr}
        style={[
          styles.cta,
          tracking && styles.ctaStop,
          (busy || permErr) && { opacity: 0.5 },
        ]}
      >
        <Text style={[styles.ctaText, tracking && { color: '#fff' }]}>
          {busy ? 'SAVING…' : tracking ? 'STOP & SAVE' : 'START WALKING'}
        </Text>
      </Pressable>

      {/* SAVED FIELDS */}
      {maps.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.savedRow}>
          {maps.map((m) => (
            <View key={m.id} style={styles.savedCard}>
              <Text style={styles.savedLabel}>{m.label}</Text>
              <Text style={styles.savedAcres}>{(m.area_acres || 0).toFixed(2)}</Text>
              <Text style={styles.savedUnit}>ACRES</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={{ height: 40 }} />
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },

  topBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: spacing.md,
  },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 70 },
  backIcon: { fontSize: 28, fontWeight: '300', color: palette.text, marginTop: -3 },
  backText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: palette.text },
  topCenter: { flex: 1, alignItems: 'center' },
  topKicker: { ...typography.micro, color: palette.textMuted },
  topTitle: { fontSize: 15, fontWeight: '900', color: palette.text, marginTop: 2, letterSpacing: -0.3 },
  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, width: 60,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999,
    borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface, justifyContent: 'center',
  },
  livePillActive: { borderColor: palette.danger },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.textDim },
  liveText: { ...typography.micro, color: palette.text },

  layerRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.md, gap: spacing.sm },
  layerChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)',
  },
  layerChipActive: { backgroundColor: palette.neon, borderColor: palette.neon },
  swatch: { width: 12, height: 12, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  layerText: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.85)' },
  layerTextActive: { color: palette.obsidian },

  mapWrap: {
    alignSelf: 'center',
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: palette.borderHi,
    backgroundColor: 'rgba(0,0,0,0.4)',
    position: 'relative',
    ...shadows.neon,
  },
  frame: { ...StyleSheet.absoluteFillObject },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: palette.neon },
  cornerTL: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 8 },
  cornerTR: { top: 8, right: 8, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 8 },
  cornerBL: { bottom: 8, left: 8, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 8 },
  cornerBR: { bottom: 8, right: 8, borderBottomWidth: 2, borderRightWidth: 2, borderBottomRightRadius: 8 },

  centerOverlay: {
    position: 'absolute', inset: 0,
    alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  loadingText: { ...typography.micro, color: palette.neon },
  errorText: { ...typography.body, color: palette.danger, textAlign: 'center', paddingHorizontal: 24 },

  coordBadge: {
    position: 'absolute', bottom: 12, left: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderWidth: 1, borderColor: palette.border,
  },
  coordText: { fontSize: 10, fontWeight: '700', color: palette.neon, fontFamily: 'monospace' },
  layerBadge: {
    position: 'absolute', top: 12, right: 12,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  layerBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: palette.neon },

  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  stat: {
    flex: 1, padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    alignItems: 'center',
  },
  statVal: { fontSize: 22, fontWeight: '900', color: palette.neon, letterSpacing: -0.5 },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },

  cta: {
    marginHorizontal: spacing.xl, marginTop: spacing.lg,
    paddingVertical: 18, borderRadius: radius.md,
    backgroundColor: palette.neon, alignItems: 'center',
    ...shadows.neon,
  },
  ctaStop: { backgroundColor: palette.danger, shadowColor: palette.danger },
  ctaText: { fontSize: 14, fontWeight: '900', letterSpacing: 1.2, color: palette.obsidian },

  savedRow: { paddingHorizontal: spacing.xl, paddingVertical: spacing.lg, gap: spacing.sm },
  savedCard: {
    padding: spacing.lg, borderRadius: radius.md, minWidth: 130,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  savedLabel: { ...typography.micro, color: palette.textMuted },
  savedAcres: { fontSize: 26, fontWeight: '900', color: palette.neon, marginTop: 4, letterSpacing: -0.8 },
  savedUnit: { ...typography.micro, color: palette.textDim, marginTop: 2 },
});
