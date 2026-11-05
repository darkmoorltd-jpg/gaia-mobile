import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, NeonButton, Pill } from '../src/components';
import { GoogleMap } from '../src/components/GoogleMap';
import {
  saveFarm, haversine, pathLength, enclosedArea,
  filterByAccuracy, simplifyPath,
  type FarmPoint,
} from '../src/utils/farms';
import { useTheme, spacing } from '../src/theme';

const MAX_ACCURACY_M = 15;
const GOOD_ACCURACY_M = 8;
const MIN_DISTANCE_M = 5;
const CLOSE_LOOP_M = 15;

type ViewMode = 'standard' | 'satellite' | 'hybrid' | 'terrain';
type DisplayMode = 'line' | 'points';
type Phase = 'idle' | 'mapping' | 'closed';
type GeoStatus = 'idle' | 'loading' | 'ok' | 'failed';

interface DetectedLocation {
  state: string;
  lga: string;
  community: string;
  ward: string;
  country: string;
}

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

// Reverse geocode via BigDataCloud (free, no API key, 30k req/month)
async function reverseGeocode(lat: number, lng: number): Promise<DetectedLocation | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d: any = await res.json();

    // Extract administrative hierarchy
    // d.localityInfo.administrative is an array ordered from country down to ward
    const admin: any[] = d.localityInfo?.administrative || [];

    const findAdmin = (level: number | string, name: string) => {
      const byLevel = admin.find((a) => a.adminLevel === level);
      if (byLevel) return byLevel.name;
      const byName = admin.find((a) => a.description === name);
      if (byName) return byName.name;
      return '';
    };

    return {
      country: d.countryName || 'Nigeria',
      state: d.principalSubdivision || findAdmin(4, 'state') || '',
      lga: d.city || findAdmin(6, 'local government area') || findAdmin(7, 'lga') || '',
      community: d.locality || findAdmin(8, 'town') || '',
      ward: findAdmin(9, 'ward') || findAdmin(10, 'ward') || '',
    };
  } catch (e) {
    console.warn('reverse geocode failed', e);
    return null;
  }
}

export default function FarmMapping() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [phase, setPhase] = useState<Phase>('idle');
  const [pinnedPoints, setPinnedPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState(false);

  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [stateName, setStateName] = useState('');
  const [lga, setLga] = useState('');
  const [community, setCommunity] = useState('');
  const [ward, setWard] = useState('');
  const [saving, setSaving] = useState(false);

  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [detected, setDetected] = useState<DetectedLocation | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('satellite');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('line');

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const geocodeAttempted = useRef(false);

  // ===== Permission + GPS tracking =====
  useEffect(() => {
    let mounted = true;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission needed', 'GAIA needs location access to map your farm.');
        return;
      }
      if (mounted) setPermission(true);

      try {
        await Location.enableNetworkProviderAsync().catch(() => {});
        const initial = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
        });
        if (mounted) {
          const p: FarmPoint = {
            latitude: initial.coords.latitude,
            longitude: initial.coords.longitude,
            accuracy: initial.coords.accuracy ?? 999,
            timestamp: initial.timestamp,
          };
          setCurrentGPS(p);
          setCurrentAccuracy(initial.coords.accuracy ?? null);
        }
      } catch (e) {
        console.log('initial location failed', e);
      }

      watcher.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          distanceInterval: 2,
          timeInterval: 2000,
        },
        (loc) => {
          const p: FarmPoint = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? 999,
            timestamp: loc.timestamp,
          };
          setCurrentGPS(p);
          setCurrentAccuracy(loc.coords.accuracy ?? null);
        },
      );
    })();

    return () => {
      mounted = false;
      watcher.current?.remove();
    };
  }, []);

  // ===== Auto reverse geocode on first GPS fix =====
  useEffect(() => {
    if (!currentGPS || geocodeAttempted.current) return;
    geocodeAttempted.current = true;

    (async () => {
      setGeoStatus('loading');
      const loc = await reverseGeocode(currentGPS.latitude, currentGPS.longitude);
      if (loc) {
        setDetected(loc);
        setGeoStatus('ok');
        // Pre-fill only if user hasn't typed manually
        if (!stateName && loc.state) setStateName(loc.state);
        if (!lga && loc.lga) setLga(loc.lga);
        if (!community && loc.community) setCommunity(loc.community);
        if (!ward && loc.ward) setWard(loc.ward);
      } else {
        setGeoStatus('failed');
      }
    })();
  }, [currentGPS, stateName, lga, community, ward]);

  // ===== Pin actions =====
  const canPin = () => {
    if (!currentGPS) return false;
    if (currentAccuracy && currentAccuracy > MAX_ACCURACY_M) return false;
    return true;
  };

  const pinStart = () => {
    if (!currentGPS) { Alert.alert('No GPS', 'Waiting for your location…'); return; }
    if (currentAccuracy && currentAccuracy > MAX_ACCURACY_M) {
      Alert.alert('GPS too weak', `Accuracy ±${currentAccuracy.toFixed(0)}m. Move to open sky.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPinnedPoints([currentGPS]);
    setPhase('mapping');
  };

  const pinCorner = () => {
    if (!currentGPS) { Alert.alert('No GPS', 'Waiting for your location…'); return; }
    if (currentAccuracy && currentAccuracy > MAX_ACCURACY_M) {
      Alert.alert('GPS too weak', `Accuracy ±${currentAccuracy.toFixed(0)}m.`); return;
    }
    if (pinnedPoints.length > 0) {
      const last = pinnedPoints[pinnedPoints.length - 1];
      const dist = haversine(last, currentGPS);
      if (dist < MIN_DISTANCE_M) {
        Alert.alert('Too close', `Only ${dist.toFixed(0)}m from last pin. Walk further.`);
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPinnedPoints([...pinnedPoints, currentGPS]);
  };

  const undoLast = () => {
    if (pinnedPoints.length === 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = pinnedPoints.slice(0, -1);
    setPinnedPoints(next);
    if (next.length === 0) setPhase('idle');
    if (phase === 'closed' && next.length < 3) setPhase('mapping');
  };

  const closeLoop = () => {
    if (pinnedPoints.length < 3) { Alert.alert('Need 3+ corners'); return; }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('closed');
  };

  const reopenLoop = () => { setPhase('mapping'); };

  const resetAll = () => {
    Alert.alert('Clear this farm?', 'All pinned corners will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setPinnedPoints([]); setPhase('idle');
      }},
    ]);
  };

  // ===== Computed stats =====
  const cleaned = filterByAccuracy(pinnedPoints, MAX_ACCURACY_M);
  const simplified = simplifyPath(cleaned, 2.5);
  const meters = pathLength(simplified);
  const sqm = enclosedArea(simplified);
  const acres = sqm / 4046.86;
  const hectares = sqm / 10000;
  const closed = phase === 'closed';
  const distFromStart = currentGPS && pinnedPoints.length > 0
    ? haversine(currentGPS, pinnedPoints[0])
    : null;
  const nearStart = distFromStart != null && distFromStart <= CLOSE_LOOP_M;

  // Centroid of the boundary (used by satellite monitor)
  const centroid = cleaned.length > 0
    ? {
        lat: cleaned.reduce((s, p) => s + p.latitude, 0) / cleaned.length,
        lng: cleaned.reduce((s, p) => s + p.longitude, 0) / cleaned.length,
      }
    : null;

  // ===== Save =====
  const save = async () => {
    if (!farmName.trim()) { Alert.alert('Name required'); return; }
    if (pinnedPoints.length < 3) { Alert.alert('Need 3+ corners'); return; }
    if (!stateName.trim()) {
      Alert.alert('State required', 'Wait for GPS detection or type manually.');
      return;
    }
    setSaving(true);
    try {
      const res = await saveFarm({
        name: farmName.trim(),
        crop: crop.trim() || undefined,
        state: stateName.trim(),
        lga: lga.trim() || undefined,
        community: community.trim() || undefined,
        ward: ward.trim() || undefined,
        centroid_lat: centroid?.lat,
        centroid_lng: centroid?.lng,
        boundary: pinnedPoints,
      } as any);
      setSaving(false);
      if (res.error) { Alert.alert('Save failed', res.error); return; }
      Alert.alert('Saved!',
        `"${farmName.trim()}" — ${hectares.toFixed(2)} ha in ${stateName.trim()}${lga ? ', ' + lga : ''}`,
        [{ text: 'OK', onPress: () => router.replace('/farms') }]);
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Save failed', e?.message || 'Unknown error');
    }
  };

  // ===== Accuracy =====
  const accuracyLabel =
    currentAccuracy == null ? 'Searching…'
    : currentAccuracy <= GOOD_ACCURACY_M ? 'Excellent'
    : currentAccuracy <= MAX_ACCURACY_M ? 'Good'
    : 'Weak';
  const accuracyColor =
    currentAccuracy == null ? palette.textMuted
    : currentAccuracy <= GOOD_ACCURACY_M ? '#00ff88'
    : currentAccuracy <= MAX_ACCURACY_M ? '#ffb300'
    : '#ff3b5c';

  const geoBadgeColor =
    geoStatus === 'ok' ? '#00ff88' :
    geoStatus === 'loading' ? '#ffb300' :
    geoStatus === 'failed' ? '#ff3b5c' : palette.textMuted;

  const geoBadgeLabel =
    geoStatus === 'ok' ? '✓ Auto-detected from GPS' :
    geoStatus === 'loading' ? 'Detecting location…' :
    geoStatus === 'failed' ? '⚠ Could not detect — type manually' :
    'Waiting for GPS…';

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        <Pill label="GPS MAPPING" />
        <Text style={styles.title}>Map Your Farm</Text>
        <Text style={styles.subtitle}>
          Walk to each corner and tap PIN. Return to start to close the loop.
        </Text>

        {/* ===== LIVE STATUS ===== */}
        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.statusRow}>
            <View style={styles.statusItem}>
              <View style={[styles.dot, { backgroundColor: accuracyColor }]} />
              <Text style={styles.statusValue}>
                {currentAccuracy != null ? `±${currentAccuracy.toFixed(0)}m` : '—'}
              </Text>
              <Text style={styles.statusLabel}>GPS {accuracyLabel}</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>{pinnedPoints.length}</Text>
              <Text style={styles.statusLabel}>CORNERS</Text>
            </View>
            <View style={styles.statusDivider} />
            <View style={styles.statusItem}>
              <Text style={styles.statusValue}>
                {distFromStart != null ? `${distFromStart.toFixed(0)}m` : '—'}
              </Text>
              <Text style={styles.statusLabel}>TO START</Text>
            </View>
          </View>

          {pinnedPoints.length >= 3 && (
            <View style={[styles.statsRow, { marginTop: 14 }]}>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{hectares.toFixed(3)}</Text>
                <Text style={styles.statLbl}>HECTARES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{acres.toFixed(3)}</Text>
                <Text style={styles.statLbl}>ACRES</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statVal}>{meters.toFixed(0)}</Text>
                <Text style={styles.statLbl}>PERIMETER m</Text>
              </View>
            </View>
          )}
        </GlassCard>

        {/* ===== DETECTED LOCATION ===== */}
        <View style={styles.geoCard}>
          <View style={styles.geoHeader}>
            <Text style={styles.geoHeaderLabel}>📍 DETECTED LOCATION</Text>
            <Text style={[styles.geoBadge, { color: geoBadgeColor }]}>{geoBadgeLabel}</Text>
          </View>
          {geoStatus === 'loading' && (
            <View style={styles.geoLoading}>
              <ActivityIndicator color={palette.neon} size="small" />
              <Text style={styles.geoLoadingText}>Querying BigDataCloud…</Text>
            </View>
          )}
          {detected && (
            <View style={styles.geoGrid}>
              <GeoRow
                icon="🏛️" label="State" value={stateName || detected.state}
                editing={!stateName} onChange={setStateName}
              />
              <GeoRow
                icon="🏙️" label="LGA" value={lga || detected.lga}
                editing={!lga} onChange={setLga}
              />
              <GeoRow
                icon="🏘️" label="Community" value={community || detected.community}
                editing={!community} onChange={setCommunity}
              />
              <GeoRow
                icon="🚏" label="Ward" value={ward || detected.ward}
                editing={!ward} onChange={setWard}
              />
            </View>
          )}
        </View>

        {/* ===== HINTS ===== */}
        {phase === 'idle' && (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>📍 Walk to the first corner, then tap PIN START</Text>
          </View>
        )}
        {phase === 'mapping' && !nearStart && (
          <View style={styles.hintBar}>
            <Text style={styles.hintText}>🚶 Walk to next corner, tap PIN CORNER</Text>
          </View>
        )}
        {phase === 'mapping' && nearStart && pinnedPoints.length >= 3 && (
          <View style={[styles.hintBar, { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: '#00ff88' }]}>
            <Text style={[styles.hintText, { color: '#00ff88' }]}>✅ Near start — tap CLOSE LOOP</Text>
          </View>
        )}
        {phase === 'closed' && (
          <View style={[styles.hintBar, { backgroundColor: 'rgba(0,255,136,0.15)', borderColor: '#00ff88' }]}>
            <Text style={[styles.hintText, { color: '#00ff88' }]}>
              🎉 Boundary complete — {hectares.toFixed(2)} ha. Fill details and save.
            </Text>
          </View>
        )}

        {/* ===== MAP ===== */}
        <View style={styles.mapBox}>
          {!permission ? (
            <View style={styles.mapLoading}>
              <ActivityIndicator color={palette.neon} />
              <Text style={styles.mapLoadingText}>Requesting location…</Text>
            </View>
          ) : (
            <GoogleMap
              points={pinnedPoints}
              center={currentGPS || undefined}
              height={340}
              closed={closed}
              mapType={viewMode}
              display={displayMode}
            />
          )}
        </View>

        <View style={styles.chipRow}>
          {VIEWS.map((v) => (
            <Pressable key={v.key} onPress={() => setViewMode(v.key)}
              style={[styles.chip, viewMode === v.key && styles.chipOn]}>
              <Text style={[styles.chipText, viewMode === v.key && styles.chipTextOn]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.chipRow}>
          {DISPLAYS.map((d) => (
            <Pressable key={d.key} onPress={() => setDisplayMode(d.key)}
              style={[styles.chip, displayMode === d.key && styles.chipOn]}>
              <Text style={[styles.chipText, displayMode === d.key && styles.chipTextOn]}>{d.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ===== ACTION BUTTONS ===== */}
        <View style={{ marginTop: spacing.lg }}>
          {phase === 'idle' && (
            <Pressable onPress={pinStart} disabled={!canPin()}
              style={[styles.bigBtn, !canPin() && { opacity: 0.5 }]}>
              <Text style={styles.bigBtnEmoji}>📍</Text>
              <Text style={styles.bigBtnLabel}>PIN START LOCATION</Text>
            </Pressable>
          )}
          {phase === 'mapping' && (
            <>
              <Pressable onPress={pinCorner} disabled={!canPin()}
                style={[styles.bigBtn, !canPin() && { opacity: 0.5 }]}>
                <Text style={styles.bigBtnEmoji}>📌</Text>
                <Text style={styles.bigBtnLabel}>PIN CORNER ({pinnedPoints.length})</Text>
              </Pressable>
              {pinnedPoints.length >= 3 && (
                <Pressable onPress={closeLoop}
                  style={[styles.bigBtn, styles.bigBtnSecondary,
                    nearStart && { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.15)' }]}>
                  <Text style={styles.bigBtnEmoji}>✅</Text>
                  <Text style={[styles.bigBtnLabel, { color: '#00ff88' }]}>CLOSE LOOP & FINISH</Text>
                </Pressable>
              )}
              {pinnedPoints.length > 0 && (
                <Pressable onPress={undoLast} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↶ UNDO LAST PIN</Text>
                </Pressable>
              )}
            </>
          )}
          {phase === 'closed' && (
            <Pressable onPress={reopenLoop} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>✏️ EDIT BOUNDARY</Text>
            </Pressable>
          )}
        </View>

        {/* ===== FARM DETAILS ===== */}
        {pinnedPoints.length >= 3 && (
          <>
            <Text style={styles.label}>FARM NAME *</Text>
            <TextInput value={farmName} onChangeText={setFarmName}
              placeholder="e.g. North Field" placeholderTextColor={palette.textDim}
              style={styles.input} />

            <Text style={styles.label}>CROP (OPTIONAL)</Text>
            <TextInput value={crop} onChangeText={setCrop}
              placeholder="e.g. Maize" placeholderTextColor={palette.textDim}
              style={styles.input} />

            <Text style={styles.label}>LOCATION (EDITABLE)</Text>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.miniLabel}>STATE</Text>
                <TextInput value={stateName} onChangeText={setStateName}
                  placeholder="e.g. Kaduna" placeholderTextColor={palette.textDim}
                  style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.miniLabel}>LGA</Text>
                <TextInput value={lga} onChangeText={setLga}
                  placeholder="e.g. Zaria" placeholderTextColor={palette.textDim}
                  style={styles.input} />
              </View>
            </View>
            <View style={styles.twoCol}>
              <View style={styles.col}>
                <Text style={styles.miniLabel}>COMMUNITY</Text>
                <TextInput value={community} onChangeText={setCommunity}
                  placeholder="e.g. Sabon Gari" placeholderTextColor={palette.textDim}
                  style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.miniLabel}>WARD</Text>
                <TextInput value={ward} onChangeText={setWard}
                  placeholder="e.g. Ward 3" placeholderTextColor={palette.textDim}
                  style={styles.input} />
              </View>
            </View>

            <View style={{ marginTop: spacing.lg }}>
              <NeonButton
                label={saving ? 'SAVING…' : closed ? 'SAVE FARM ✅' : 'SAVE FARM'}
                onPress={save} loading={saving}
                disabled={saving || !farmName.trim() || !stateName.trim()}
              />
            </View>
            <View style={{ marginTop: spacing.sm }}>
              <NeonButton label="CLEAR ALL PINS" variant="ghost" onPress={resetAll} />
            </View>
          </>
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

function GeoRow({ icon, label, value, editing, onChange }: any) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
      <Text style={{ fontSize: 16, width: 24 }}>{icon}</Text>
      <Text style={{ fontSize: 11, color: '#888', width: 80 }}>{label}</Text>
      {editing ? (
        <TextInput
          value={value || ''}
          onChangeText={onChange}
          placeholder={`Enter ${label}`}
          placeholderTextColor="#555"
          style={{ flex: 1, color: '#fff', fontSize: 13, paddingVertical: 4 }}
        />
      ) : (
        <Text style={{ flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' }}>
          {value || '—'}
        </Text>
      )}
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { fontSize: 13, color: p.textMuted, marginTop: 6, lineHeight: 18 },

  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusItem: { flex: 1, alignItems: 'center', gap: 4 },
  statusDivider: { width: 1, height: 40, backgroundColor: p.border },
  statusValue: { fontSize: 18, fontWeight: '900', color: p.neon },
  statusLabel: { fontSize: 9, color: p.textMuted, fontWeight: '700', letterSpacing: 1.2 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  statsRow: { flexDirection: 'row', justifyContent: 'space-around', paddingTop: 14, borderTopWidth: 1, borderTopColor: p.border },
  stat: { alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 9, color: p.textMuted, fontWeight: '700', letterSpacing: 1.2, marginTop: 2 },

  geoCard: {
    marginTop: 14, padding: 14, borderRadius: 14,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  geoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  geoHeaderLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  geoBadge: { fontSize: 10, fontWeight: '700' },
  geoLoading: { flexDirection: 'row', gap: 8, alignItems: 'center', paddingVertical: 8 },
  geoLoadingText: { fontSize: 11, color: p.textMuted },
  geoGrid: {},

  hintBar: {
    marginTop: 12, padding: 12, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: p.border,
  },
  hintText: { fontSize: 12, color: p.text, textAlign: 'center', lineHeight: 18 },

  mapBox: {
    borderRadius: 20, overflow: 'hidden', marginTop: 14,
    borderWidth: 1, borderColor: p.borderHi,
    shadowColor: p.neon, shadowOpacity: 0.35, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
    minHeight: 340, backgroundColor: p.abyss,
  },
  mapLoading: { flex: 1, minHeight: 340, alignItems: 'center', justifyContent: 'center', gap: 12 },
  mapLoadingText: { fontSize: 12, color: p.textMuted },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },

  bigBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingVertical: 20, borderRadius: 16, marginBottom: 10,
    backgroundColor: p.neon,
    shadowColor: p.neon, shadowOpacity: 0.4, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  bigBtnSecondary: { backgroundColor: 'rgba(0,255,136,0.12)', borderWidth: 2, borderColor: 'rgba(0,255,136,0.4)' },
  bigBtnEmoji: { fontSize: 22 },
  bigBtnLabel: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },

  smallBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: p.borderHi, alignItems: 'center', marginTop: 4 },
  smallBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: p.text },

  label: { fontSize: 10, color: p.textMuted, marginTop: 16, marginBottom: 6, fontWeight: '800', letterSpacing: 1.5 },
  miniLabel: { fontSize: 9, color: p.textDim, marginBottom: 4, fontWeight: '700', letterSpacing: 1 },
  input: {
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14,
    color: p.text, fontSize: 15,
  },
  twoCol: { flexDirection: 'row', gap: 12, marginTop: 8 },
  col: { flex: 1 },
});
