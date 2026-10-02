import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, NeonButton, Pill } from '../src/components';
import { GoogleMap } from '../src/components/GoogleMap';
import {
  saveFarm, haversine, pathLength, enclosedArea,
  isNearStart, distanceToStart,
} from '../src/utils/farms';
import { useTheme, spacing, radius } from '../src/theme';

interface P { latitude: number; longitude: number; }

const MOVE_THRESHOLD_MS = 0.4;   // m/s — below this = "stopped"
const MIN_DISTANCE_M = 3;       // don't add point if moved < 3m
const PAUSE_AFTER_MS = 3000;    // 3s of no movement = paused
const CLOSE_LOOP_M = 8;         // within 8m of start = loop closed

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [points, setPoints] = useState<P[]>([]);
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [current, setCurrent] = useState<P | null>(null);
  const [permission, setPermission] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [saving, setSaving] = useState(false);

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const lastMoveTime = useRef<number>(Date.now());
  const lastPoint = useRef<P | null>(null);

  // ---------- Initial position ----------
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'GAIA needs location access to map your farm.');
        return;
      }
      setPermission(true);
      try {
        // Enable network provider for better accuracy when GPS is weak
        await Location.enableNetworkProviderAsync().catch(() => {});
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        setCurrent({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch (e) {
        console.log('initial location failed', e);
      }
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  // ---------- Recording ----------
  const startRecording = async () => {
    if (!permission) return;
    setRecording(true);
    setPaused(false);
    lastMoveTime.current = Date.now();

    watcher.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 1,     // check every 1m of movement
        timeInterval: 1500,      // or every 1.5s
      },
      (loc) => {
        const p: P = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setCurrent(p);

        const speed = Math.max(0, loc.coords.speed ?? 0); // m/s

        if (speed < MOVE_THRESHOLD_MS) {
          // Stopped — check if we should mark as paused
          if (Date.now() - lastMoveTime.current > PAUSE_AFTER_MS) {
            setPaused(true);
          }
          return; // don't add point while stopped
        }

        // Moving again — clear pause
        setPaused(false);
        lastMoveTime.current = Date.now();

        // Only add point if we've moved far enough from the last one
        if (lastPoint.current && haversine(lastPoint.current, p) < MIN_DISTANCE_M) {
          return;
        }

        lastPoint.current = p;
        setPoints((prev) => [...prev, p]);
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
    lastPoint.current = null;
  };

  const save = async () => {
    if (!farmName.trim()) { Alert.alert('Name required'); return; }
    if (points.length < 3) { Alert.alert('Need more points', 'Walk at least 3 corners.'); return; }
    setSaving(true);
    stopRecording();
    const { error } = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      boundary: points,
    });
    setSaving(false);
    if (error) { Alert.alert('Save failed', error); return; }
    Alert.alert('Saved', 'Farm boundary mapped.', [
      { text: 'OK', onPress: () => router.replace('/farms') },
    ]);
  };

  const meters = pathLength(points);
  const acres = enclosedArea(points) / 4046.86;
  const closed = isNearStart(points, CLOSE_LOOP_M);
  const distToStart = distanceToStart(points);

  return (
    <Screen glow="crops">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>← BACK</Text>
        </Pressable>

        <Pill label="GPS Mapping" />
        <Text style={styles.title}>Map Farm</Text>
        <Text style={styles.subtitle}>
          Walk the boundary. Recording pauses when you stop. Resumes when you move.
        </Text>

        {/* Stats */}
        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{points.length}</Text>
              <Text style={styles.statLbl}>POINTS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{meters.toFixed(0)}</Text>
              <Text style={styles.statLbl}>METERS</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{acres.toFixed(3)}</Text>
              <Text style={styles.statLbl}>ACRES</Text>
            </View>
          </View>
        </GlassCard>

        {/* Status banner */}
        {recording && (
          <GlassCard style={{ marginTop: spacing.md }}>
            {paused ? (
              <Text style={styles.pausedText}>⏸ PAUSED — stopped moving. Walk to resume.</Text>
            ) : closed ? (
              <Text style={styles.closedText}>✅ LOOP CLOSED — back at start</Text>
            ) : points.length > 2 ? (
              <Text style={styles.hintText}>
                ↻ Recording · {distToStart.toFixed(0)} m from start
              </Text>
            ) : (
              <Text style={styles.hintText}>▶ RECORDING — keep walking</Text>
            )}
          </GlassCard>
        )}

        {/* Map */}
        <View style={styles.mapBox}>
          <GoogleMap
            points={points}
            center={current || undefined}
            height={340}
            closed={closed}
          />
        </View>

        {/* Controls */}
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

        <View style={{ height: spacing.lg }} />

        {points.length > 2 && !recording && (
          <NeonButton
            label={saving ? '' : closed ? 'SAVE FARM (LOOP CLOSED)' : 'SAVE FARM'}
            onPress={save}
            loading={saving}
            disabled={saving}
          />
        )}

        {points.length > 0 && !recording && (
          <>
            <View style={{ height: spacing.sm }} />
            <NeonButton label="CLEAR PATH" variant="ghost" onPress={resetPath} />
          </>
        )}

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
  statVal: { fontSize: 22, fontWeight: '900', color: p.neon, letterSpacing: -0.5 },
  statLbl: { fontSize: 10, color: p.textMuted, marginTop: 4, fontWeight: '700', letterSpacing: 1.5 },
  pausedText: { fontSize: 12, color: p.warning, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  closedText: { fontSize: 12, color: p.neon, textAlign: 'center', fontWeight: '800', letterSpacing: 0.5 },
  hintText: { fontSize: 12, color: p.textMuted, textAlign: 'center', fontWeight: '600' },
  mapBox: {
    borderRadius: 20, overflow: 'hidden', marginTop: 16,
    borderWidth: 1, borderColor: p.borderHi,
    shadowColor: p.neon, shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 0 }, elevation: 12,
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
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: p.text, fontSize: 15,
  },
});
