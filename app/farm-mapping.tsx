import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, NeonButton, LeafletMap } from '../src/components';
import { saveFarm, haversine, pathLength, enclosedArea } from '../src/utils/farms';
import { palette, typography, spacing, radius, shadows } from '../src/theme';

interface P { latitude: number; longitude: number; }

export default function FarmMapping() {
  const router = useRouter();
  const [points, setPoints] = useState<P[]>([]);
  const [recording, setRecording] = useState(false);
  const [current, setCurrent] = useState<P | null>(null);
  const [permission, setPermission] = useState(false);
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [saving, setSaving] = useState(false);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'GAIA needs location access.');
        return;
      }
      setPermission(true);
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCurrent({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  const startRecording = async () => {
    if (!permission) return;
    setRecording(true);
    watcher.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 2000 },
      (loc) => {
        const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setCurrent(p);
        setPoints((prev) => {
          if (prev.length > 0 && haversine(prev[prev.length - 1], p) < 2) return prev;
          return [...prev, p];
        });
      },
    );
  };

  const stopRecording = () => {
    watcher.current?.remove();
    watcher.current = null;
    setRecording(false);
  };

  const save = async () => {
    if (!farmName.trim()) { Alert.alert('Name required'); return; }
    if (points.length < 3) { Alert.alert('Need more points'); return; }
    setSaving(true);
    stopRecording();
    const { error } = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      boundary: points,
    });
    setSaving(false);
    if (error) { Alert.alert('Save failed', error); return; }
    Alert.alert('Saved', 'Farm mapped successfully.', [
      { text: 'OK', onPress: () => router.replace('/farms') },
    ]);
  };

  const meters = pathLength(points);
  const acres = enclosedArea(points) / 4046.86;

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Map Farm</Text>
        <Text style={styles.subtitle}>Walk the field edge — GPS draws the line.</Text>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.statRow}>
            <View style={styles.stat}><Text style={styles.statVal}>{points.length}</Text><Text style={styles.statLbl}>POINTS</Text></View>
            <View style={styles.stat}><Text style={styles.statVal}>{meters.toFixed(0)}</Text><Text style={styles.statLbl}>METERS</Text></View>
            <View style={styles.stat}><Text style={styles.statVal}>{acres.toFixed(3)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
          </View>
        </GlassCard>

        <View style={styles.mapBox}>
          <LeafletMap points={points} center={current || undefined} height={340} />
        </View>

        {recording ? (
          <View style={styles.recordRow}>
            <View style={styles.recBadge}>
              <View style={styles.recDot} />
              <Text style={styles.recText}>RECORDING</Text>
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
        <TextInput value={farmName} onChangeText={setFarmName} placeholder="e.g. North Field" placeholderTextColor={palette.textDim} style={styles.input} />

        <Text style={styles.label}>CROP (OPTIONAL)</Text>
        <TextInput value={crop} onChangeText={setCrop} placeholder="e.g. Maize" placeholderTextColor={palette.textDim} style={styles.input} />

        <View style={{ height: spacing.lg }} />

        {points.length > 2 && !recording && (
          <NeonButton label={saving ? '' : 'SAVE FARM'} onPress={save} loading={saving} disabled={saving} />
        )}

        {points.length > 0 && !recording && (
          <>
            <View style={{ height: spacing.sm }} />
            <NeonButton label="CLEAR PATH" variant="ghost" onPress={() => setPoints([])} />
          </>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 22, fontWeight: '900', color: palette.neon, letterSpacing: -0.5 },
  statLbl: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  mapBox: { borderRadius: radius.lg, overflow: 'hidden', marginTop: spacing.lg, borderWidth: 1, borderColor: palette.borderHi, ...shadows.neon },
  recordRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg },
  recBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, backgroundColor: palette.danger + '22', borderWidth: 1, borderColor: palette.danger },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.danger },
  recText: { ...typography.micro, color: palette.danger, fontWeight: '800' },
  label: { ...typography.micro, color: palette.textMuted, marginTop: spacing.md, marginBottom: 6 },
  input: { backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border, borderRadius: radius.md, padding: spacing.md, color: palette.text, fontSize: 15 },
});
