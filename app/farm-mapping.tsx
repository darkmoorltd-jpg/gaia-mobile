import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, NeonButton, Pill } from '../src/components';
import { MapLibreMap } from '../src/components/MapLibreMap';
import {
  saveFarm, haversine, pathLength, enclosedArea,
  isNearStart, distanceToStart, accuracyAverage,
  filterByAccuracy, simplifyPath,
  type FarmPoint,
} from '../src/utils/farms';
import { useTheme, spacing } from '../src/theme';

const MOVE_THRESHOLD_MS = 0.4;
const MIN_DISTANCE_M = 3;
const MAX_ACCURACY_M = 15;
const PAUSE_AFTER_MS = 4000;
const CLOSE_LOOP_M = 10;

type ViewMode = 'standard' | 'satellite' | 'hybrid' | 'terrain';
type DisplayMode = 'line' | 'points';

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'standard', label: 'Dark' },
  { key: 'satellite', label: 'Satellite' },
  { key: 'terrain', label: 'Terrain' },
  { key: 'hybrid', label: 'Hybrid' },
];

const DISPLAYS: { key: DisplayMode; label: string }[] = [
  { key: 'line', label: 'Line' },
  { key: 'points', label: 'Points' },
];

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [points, setPoints] = useState<FarmPoint[]>([]);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<FarmPoint | null>(null);
  const [permission, setPermission] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [state, setState] = useState('');
  const [lga, setLga] = useState('');
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('line');

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const lastMoveTime = useRef<number>(Date.now());
  const lastPoint = useRef<FarmPoint | null>(null);
  const pointsRef = useRef<FarmPoint[]>([]);

  useEffect(() => {
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'GAIA needs location access to map your farm.');
        return;
      }
      setPermission(true);
      try {
        await Location.enableNetworkProviderAsync().catch(() => {});
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setCurrent({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        console.log('initial location failed', e);
      }
    })();
    return () => {
      watcher.current?.remove();
    };
  }, []);

  const startRecording = async () => {
    if (!permission) {
      Alert.alert('Permission denied', 'Enable location in settings.');
      return;
    }
    setRecording(true);
    setPaused(false);
    lastMoveTime.current = Date.now();

    watcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 1,
        timeInterval: 1500,
      },
      (loc) => {
        const acc = loc.coords.accuracy ?? 999;
        const p: FarmPoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: acc,
          timestamp: loc.timestamp,
        };
        setCurrent(p);

        if (acc > MAX_ACCURACY_M) return;

        const speed = Math.max(0, loc.coords.speed ?? 0);

        if (speed < MOVE_THRESHOLD_MS) {
          if (Date.now() - lastMoveTime.current > PAUSE_AFTER_MS) setPaused(true);
          return;
        }

        setPaused(false);
        lastMoveTime.current = Date.now();

        if (lastPoint.current && haversine(lastPoint.current, p) < MIN_DISTANCE_M) {
          return;
        }

        lastPoint.current = p;
        const next = pointsRef.current.concat([p]);
        pointsRef.current = next;
        setPoints(next);
      },
    );
  };

  const stopRecording = () => {
    watcher.current?.remove();
    watcher.current = null;
    setRecording(false);
    setPaused(false);
  };

  const resetPath = () => {
    stopRecording();
    setPoints([]);
    pointsRef.current = [];
    lastPoint.current = null;
  };

  const save = async () => {
    if (!farmName.trim()) {
      Alert.alert('Name required', 'Enter a name for this farm.');
      return;
    }
    if (points.length < 3) {
      Alert.alert('Need more points', 'Walk at least 3 corners.');
      return;
    }
    setSaving(true);
    stopRecording();
    const res = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      state: state.trim() || undefined,
      lga: lga.trim() || undefined,
      boundary: points,
    });
    setSaving(false);
    if (res.error) {
      Alert.alert('Save failed', res.error);
      return;
    }
    Alert.alert('Saved', 'Farm boundary mapped.', [
      { text: 'OK', onPress: () => router.replace('/farms') },
    ]);
  };

  const cleaned = filterByAccuracy(points, MAX_ACCURACY_M);
  const simplified = simplifyPath(cleaned, 2.5);
  const meters = pathLength(simplified);
  const sqm = enclosedArea(simplified);
  const acres = sqm / 4046.86;
  const hectares = sqm / 10000;
  const closed = isNearStart(cleaned, CLOSE_LOOP_M);
  const distToStart = distanceToStart(cleaned);
  const accAvg = accuracyAverage(cleaned);

  return (
    <Screen glow="crops">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Pill label="GPS Mapping" />
        <Text style={styles.title}>Map Farm</Text>
        <Text style={styles.subtitle}>
          Walk the boundary. The line draws as you move and pauses when you stop. Finish where you started.
        </Text>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{cleaned.length}</Text>
              <Text style={styles.statLbl}>POINTS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{meters.toFixed(0)}</Text>
              <Text style={styles.statLbl}>METERS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{hectares.toFixed(3)}</Text>
              <Text style={styles.statLbl}>HECTARES</Text>
            </View>
          </View>
          <View style={[styles.statRow, { marginTop: 12 }]}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{acres.toFixed(3)}</Text>
              <Text style={styles.statLbl}>ACRES</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{accAvg != null ? accAvg.toFixed(1) : '--'}</Text>
              <Text style={styles.statLbl}>ACCURACY m</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{distToStart.toFixed(0)}</Text>
              <Text style={styles.statLbl}>TO START m</Text>
            </View>
          </View>
        </GlassCard>

        {recording ? (
          <GlassCard style={{ marginTop: spacing.md }}>
            {paused ? (
              <Text style={styles.pausedText}>PAUSED - stopped moving. Walk to resume.</Text>
            ) : closed ? (
              <Text style={styles.closedText}>LOOP CLOSED - back at start</Text>
            ) : cleaned.length > 2 ? (
              <Text style={styles.hintText}>RECORDING - {distToStart.toFixed(0)} m from start</Text>
            ) : (
              <Text style={styles.hintText}>RECORDING - keep walking</Text>
            )}
          </GlassCard>
        ) : null}

        <View style={styles.chipRow}>
          {VIEWS.map((v) => (
            <Pressable
              key={v.key}
              onPress={() => setViewMode(v.key)}
              style={[styles.chip, viewMode === v.key && styles.chipOn]}
            >
              <Text style={[styles.chipText, viewMode === v.key && styles.chipTextOn]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.chipRow}>
          {DISPLAYS.map((d) => (
            <Pressable
              key={d.key}
              onPress={() => setDisplayMode(d.key)}
              style={[styles.chip, displayMode === d.key && styles.chipOn]}
            >
              <Text style={[styles.chipText, displayMode === d.key && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.mapBox}>
          <MapLibreMap
            points={cleaned}
            center={current || undefined}
            height={340}
            closed={closed}
            mapType={viewMode}
            display={displayMode}
          />
        </View>

        {recording ? (
          <View style={styles.recordRow}>
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>{paused ? 'PAUSED' : 'RECORDING'}</Text>
            </View>
            <NeonButton label="STOP" variant="danger" onPress={stopRecording} />
          </View>
        ) : (
          <NeonButton
            label={points.length > 0 ? 'RESUME WALK' : 'START WALKING'}
            onPress={startRecording}
            style={{ marginTop: spacing.lg }}
          />
        )}

        <Text style={styles.label}>FARM NAME</Text>
        <TextInput
          value={farmName}
          onChangeText={setFarmName}
          placeholder="e.g. North Field"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <Text style={styles.label}>CROP (OPTIONAL)</Text>
        <TextInput
          value={crop}
          onChangeText={setCrop}
          placeholder="e.g. Maize"
          placeholderTextColor={palette.textDim}
          style={styles.input}
        />

        <View style={styles.twoCol}>
          <View style={styles.col}>
            <Text style={styles.label}>STATE</Text>
            <TextInput
              value={state}
              onChangeText={setState}
              placeholder="e.g. Kaduna"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
          </View>
          <View style={styles.col}>
            <Text style={styles.label}>LGA</Text>
            <TextInput
              value={lga}
              onChangeText={setLga}
              placeholder="e.g. Zaria"
              placeholderTextColor={palette.textDim}
              style={styles.input}
            />
          </View>
        </View>

        <View style={{ height: spacing.lg }} />

        {points.length > 2 && !recording ? (
          <NeonButton
            label={saving ? 'SAVING...' : closed ? 'SAVE FARM (LOOP CLOSED)' : 'SAVE FARM'}
            onPress={save}
            loading={saving}
            disabled={saving}
          />
        ) : null}

        {points.length > 0 && !recording ? (
          <View style={{ marginTop: spacing.sm }}>
            <NeonButton label="CLEAR PATH" variant="ghost" onPress={resetPath} />
          </View>
        ) : null}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 6, lineHeight: 18 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 20, fontWeight: '900', color: p.neon, letterSpacing: -0.5 },
  statLbl: { fontSize: 9, color: p.textMuted, marginTop: 4, fontWeight: '700', letterSpacing: 1.5 },
  pausedText: { fontSize: 12, color: p.warning, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  closedText: { fontSize: 12, color: p.neon, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  hintText: { fontSize: 12, color: p.textMuted, textAlign: 'center', fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  mapBox: {
    borderRadius: 20,
    overflow: 'hidden',
    marginTop: 12,
    borderWidth: 1,
    borderColor: p.borderHi,
    shadowColor: p.neon,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  recBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
    backgroundColor: 'rgba(255,59,92,0.15)', borderWidth: 1, borderColor: p.danger,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: p.danger },
  recText: { fontSize: 10, color: p.danger, fontWeight: '900', letterSpacing: 1.2 },
  label: { fontSize: 10, color: p.textMuted, marginTop: 16, marginBottom: 6, fontWeight: '800', letterSpacing: 1.5 },
  input: {
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: p.text,
    fontSize: 15,
  },
  twoCol: { flexDirection: 'row', gap: 12 },
  col: { flex: 1 },
});
