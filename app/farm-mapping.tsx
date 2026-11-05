import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator, Switch,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { GoogleMap } from '../src/components/GoogleMap';
import {
  saveFarm, haversine, pathLength, enclosedArea,
  filterByAccuracy, simplifyPath,
  type FarmPoint,
} from '../src/utils/farms';

const MAX_ACCURACY_M = 15;
const GOOD_ACCURACY_M = 8;
const MIN_DISTANCE_M = 5;
const CLOSE_LOOP_M = 15;

type ViewMode = 'standard' | 'satellite' | 'hybrid' | 'terrain';
type DisplayMode = 'line' | 'points';
type Phase = 'idle' | 'mapping' | 'closed';

interface DetectedLocation {
  state: string; lga: string; community: string; ward: string; country: string;
}

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: 'satellite', label: 'Satellite' },
  { key: 'standard', label: 'Street' },
  { key: 'terrain', label: 'Terrain' },
];

async function reverseGeocode(lat: number, lng: number): Promise<DetectedLocation | null> {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const d: any = await res.json();
    const admin: any[] = d.localityInfo?.administrative || [];
    const state = d.principalSubdivision || admin.find((a) => a.adminLevel === 4)?.name || '';
    const lga = d.city || admin.find((a) => a.adminLevel === 6)?.name || admin.find((a) => a.adminLevel === 7)?.name || '';
    const community = d.locality || admin.find((a) => a.adminLevel === 8)?.name || '';
    const ward = admin.find((a) => a.adminLevel === 9)?.name || admin.find((a) => a.adminLevel === 10)?.name || '';
    return {
      country: d.countryName || 'Nigeria',
      state, lga, community, ward,
    };
  } catch (e) {
    console.warn('reverse geocode failed', e);
    return null;
  }
}

export default function FarmMapping() {
  const router = useRouter();
  const [isLight, setIsLight] = useState(false);
  const styles = createStyles(isLight);

  const [phase, setPhase] = useState<Phase>('idle');
  const [pinnedPoints, setPinnedPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [currentAccuracy, setCurrentAccuracy] = useState<number | null>(null);
  const [permission, setPermission] = useState(false);
  const [detected, setDetected] = useState<DetectedLocation | null>(null);

  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [stateName, setStateName] = useState('');
  const [lga, setLga] = useState('');
  const [community, setCommunity] = useState('');
  const [ward, setWard] = useState('');
  const [saving, setSaving] = useState(false);

  const [viewMode, setViewMode] = useState<ViewMode>('satellite');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('line');

  const watcher = useRef<Location.LocationSubscription | null>(null);
  const geocodeAttempted = useRef(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        if (mounted) setPermission(true);

        try {
          const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
          if (mounted) {
            setCurrentGPS({ latitude: initial.coords.latitude, longitude: initial.coords.longitude, accuracy: initial.coords.accuracy ?? 999, timestamp: initial.timestamp });
            setCurrentAccuracy(initial.coords.accuracy ?? null);
          }
        } catch (e) {}

        watcher.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 2, timeInterval: 2000 },
          (loc) => {
            if (mounted) {
              setCurrentGPS({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 999, timestamp: loc.timestamp });
              setCurrentAccuracy(loc.coords.accuracy ?? null);
            }
          },
        );
      } catch (err) {
        console.warn('Location tracking error:', err);
      }
    })();
    return () => { mounted = false; watcher.current?.remove(); };
  }, []);

  useEffect(() => {
    if (!currentGPS || geocodeAttempted.current) return;
    geocodeAttempted.current = true;
    (async () => {
      const loc = await reverseGeocode(currentGPS.latitude, currentGPS.longitude);
      if (loc) {
        setDetected(loc);
        if (!stateName && loc.state) setStateName(loc.state);
        if (!lga && loc.lga) setLga(loc.lga);
        if (!community && loc.community) setCommunity(loc.community);
        if (!ward && loc.ward) setWard(loc.ward);
      }
    })();
  }, [currentGPS, stateName, lga, community, ward]);

  const canPin = () => currentGPS && (!currentAccuracy || currentAccuracy <= MAX_ACCURACY_M);

  const pinStart = () => {
    if (!canPin()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPinnedPoints([currentGPS!]);
    setPhase('mapping');
  };

  const pinCorner = () => {
    if (!canPin()) return;
    if (pinnedPoints.length > 0) {
      const last = pinnedPoints[pinnedPoints.length - 1];
      const dist = haversine(last, currentGPS!);
      if (dist < MIN_DISTANCE_M) {
        Alert.alert('Too close', `Only ${dist.toFixed(0)}m from last pin. Walk further.`);
        return;
      }
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPinnedPoints([...pinnedPoints, currentGPS!]);
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
    if (pinnedPoints.length < 3) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setPhase('closed');
  };

  const resetAll = () => {
    Alert.alert('Clear this farm?', 'All pinned corners will be removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => { setPinnedPoints([]); setPhase('idle'); }},
    ]);
  };

  const cleaned = filterByAccuracy(pinnedPoints, MAX_ACCURACY_M);
  const simplified = simplifyPath(cleaned, 2.5);
  const meters = pathLength(simplified);
  const sqm = enclosedArea(simplified);
  const hectares = sqm / 10000;
  const acres = sqm / 4046.86;
  const closed = phase === 'closed';

  const distFromStart = currentGPS && pinnedPoints.length > 0 ? haversine(currentGPS, pinnedPoints[0]) : null;
  const distFromLast = currentGPS && pinnedPoints.length > 0 ? haversine(currentGPS, pinnedPoints[pinnedPoints.length - 1]) : null;
  const nearStart = distFromStart != null && distFromStart <= CLOSE_LOOP_M;

  const centroid = cleaned.length > 0 ? {
    lat: cleaned.reduce((s, p) => s + p.latitude, 0) / cleaned.length,
    lng: cleaned.reduce((s, p) => s + p.longitude, 0) / cleaned.length,
  } : null;

  const save = async () => {
    if (!farmName.trim() || pinnedPoints.length < 3 || !stateName.trim()) {
      Alert.alert('Missing info', 'Farm Name, State, and 3+ pins are required.');
      return;
    }
    setSaving(true);
    try {
      const res = await saveFarm({
        name: farmName.trim(), crop: crop.trim() || undefined,
        state: stateName.trim(), lga: lga.trim() || undefined,
        community: community.trim() || undefined, ward: ward.trim() || undefined,
        centroid_lat: centroid?.lat, centroid_lng: centroid?.lng,
        boundary: pinnedPoints,
      } as any);
      setSaving(false);
      if (res.error) { Alert.alert('Save failed', res.error); return; }
      Alert.alert('Saved!', `"${farmName.trim()}" — ${hectares.toFixed(2)} ha`, [
        { text: 'OK', onPress: () => router.replace('/farms') }
      ]);
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Save failed', e?.message || 'Unknown error');
    }
  };

  const accuracyColor = currentAccuracy == null ? '#888' : currentAccuracy <= GOOD_ACCURACY_M ? '#00c853' : currentAccuracy <= MAX_ACCURACY_M ? '#ffb300' : '#ff3b5c';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>‹ BACK</Text>
          </Pressable>
          <View style={styles.toggleWrap}>
            <Text style={styles.toggleLabel}>LIGHT</Text>
            <Switch value={isLight} onValueChange={setIsLight} trackColor={{ false: '#333', true: '#ddd' }} thumbColor={isLight ? '#fff' : '#888'} />
          </View>
        </View>

        <Text style={styles.title}>Map Your Farm</Text>
        <Text style={styles.subtitle}>Walk to each corner and tap PIN. Return to start to close the loop.</Text>

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <View style={[styles.dot, { backgroundColor: accuracyColor }]} />
              <Text style={[styles.statVal, { color: accuracyColor }]}>{currentAccuracy != null ? `±${currentAccuracy.toFixed(0)}m` : '—'}</Text>
              <Text style={styles.statLbl}>GPS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{pinnedPoints.length}</Text>
              <Text style={styles.statLbl}>PINS</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statVal}>{distFromLast != null ? `${distFromLast.toFixed(0)}m` : '—'}</Text>
              <Text style={styles.statLbl}>LAST PIN</Text>
            </View>
          </View>

          {pinnedPoints.length >= 3 && (
            <View style={styles.areaRow}>
              <View style={styles.statItem}><Text style={styles.areaVal}>{hectares.toFixed(3)}</Text><Text style={styles.statLbl}>HECTARES</Text></View>
              <View style={styles.statItem}><Text style={styles.areaVal}>{acres.toFixed(3)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
            </View>
          )}
        </View>

        {detected && (
          <View style={styles.geoCard}>
            <Text style={styles.geoLabel}>📍 AUTO-DETECTED LOCATION</Text>
            <Text style={styles.geoText}>{detected.community}, {detected.lga}, {detected.state}</Text>
          </View>
        )}

        <View style={styles.mapBox}>
          {!permission ? (
            <View style={styles.center}><ActivityIndicator color="#00c853" /><Text style={styles.dim}>Locating…</Text></View>
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
            <Pressable key={v.key} onPress={() => setViewMode(v.key)} style={[styles.chip, viewMode === v.key && styles.chipOn]}>
              <Text style={[styles.chipTxt, viewMode === v.key && styles.chipTxtOn]}>{v.label}</Text>
            </Pressable>
          ))}
        </View>

        {pinnedPoints.length > 0 && (
          <View style={styles.pointsCard}>
            <Text style={styles.pointsTitle}>PINNED POINTS ({pinnedPoints.length})</Text>
            {pinnedPoints.map((p, i) => (
              <View key={i} style={styles.pointRow}>
                <Text style={styles.pointIdx}>{i === 0 ? 'START' : `PIN ${i}`}</Text>
                <Text style={styles.pointCoord}>{p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}</Text>
                <Text style={styles.pointAcc}>±{p.accuracy?.toFixed(0)}m</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ marginTop: 20 }}>
          {phase === 'idle' && (
            <Pressable onPress={pinStart} disabled={!canPin()} style={[styles.bigBtn, !canPin() && { opacity: 0.5 }]}>
              <Text style={styles.bigBtnLabel}>📍 PIN START</Text>
            </Pressable>
          )}
          {phase === 'mapping' && (
            <>
              <Pressable onPress={pinCorner} disabled={!canPin()} style={[styles.bigBtn, !canPin() && { opacity: 0.5 }]}>
                <Text style={styles.bigBtnLabel}>📌 ADD CORNER ({pinnedPoints.length})</Text>
              </Pressable>
              {pinnedPoints.length >= 3 && (
                <Pressable onPress={closeLoop} style={[styles.bigBtn, styles.bigBtnSecondary, nearStart && { borderColor: '#00c853', backgroundColor: 'rgba(0,200,83,0.1)' }]}>
                  <Text style={[styles.bigBtnLabel, { color: '#00c853' }]}>✅ CLOSE LOOP</Text>
                </Pressable>
              )}
              {pinnedPoints.length > 0 && (
                <Pressable onPress={undoLast} style={styles.smallBtn}>
                  <Text style={styles.smallBtnText}>↶ UNDO LAST</Text>
                </Pressable>
              )}
            </>
          )}
          {phase === 'closed' && (
            <Pressable onPress={() => setPhase('mapping')} style={styles.smallBtn}>
              <Text style={styles.smallBtnText}>✏️ EDIT BOUNDARY</Text>
            </Pressable>
          )}
        </View>

        {pinnedPoints.length >= 3 && (
          <>
            <Text style={styles.label}>FARM NAME *</Text>
            <TextInput value={farmName} onChangeText={setFarmName} placeholder="e.g. North Field" placeholderTextColor="#999" style={styles.input} />

            <Text style={styles.label}>CROP (OPTIONAL)</Text>
            <TextInput value={crop} onChangeText={setCrop} placeholder="e.g. Maize" placeholderTextColor="#999" style={styles.input} />

            <View style={styles.row}>
              <View style={styles.col}>
                <Text style={styles.label}>STATE *</Text>
                <TextInput value={stateName} onChangeText={setStateName} placeholder="State" placeholderTextColor="#999" style={styles.input} />
              </View>
              <View style={styles.col}>
                <Text style={styles.label}>LGA</Text>
                <TextInput value={lga} onChangeText={setLga} placeholder="LGA" placeholderTextColor="#999" style={styles.input} />
              </View>
            </View>

            <Pressable onPress={save} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.5 }]}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>SAVE FARM</Text>}
            </Pressable>

            <Pressable onPress={resetAll} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>CLEAR ALL PINS</Text>
            </Pressable>
          </>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (isLight: boolean) => {
  const bg = isLight ? '#f5f7fa' : '#0a0e0c';
  const cardBg = isLight ? '#ffffff' : '#151d18';
  const text = isLight ? '#111827' : '#ffffff';
  const textMuted = isLight ? '#6b7280' : '#8899a6';
  const border = isLight ? '#e5e7eb' : '#2e3a34';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: bg },
    scroll: { padding: 20, paddingTop: 60 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    backBtn: { paddingVertical: 8, paddingRight: 16 },
    backText: { fontSize: 14, fontWeight: '700', color: textMuted },
    toggleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    toggleLabel: { fontSize: 10, fontWeight: '800', color: textMuted, letterSpacing: 1 },

    title: { fontSize: 30, fontWeight: '900', color: text, letterSpacing: -1 },
    subtitle: { fontSize: 13, color: textMuted, marginTop: 4, marginBottom: 20, lineHeight: 18 },

    statsCard: { backgroundColor: cardBg, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: border, marginBottom: 16 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    statItem: { flex: 1, alignItems: 'center', gap: 4 },
    statDivider: { width: 1, height: 40, backgroundColor: border },
    statVal: { fontSize: 20, fontWeight: '900', color: text },
    statLbl: { fontSize: 9, fontWeight: '700', color: textMuted, letterSpacing: 1.2 },
    dot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },

    areaRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: border, paddingTop: 16, marginTop: 16 },
    areaVal: { fontSize: 22, fontWeight: '900', color: '#00c853' },

    geoCard: { backgroundColor: cardBg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: border, marginBottom: 16 },
    geoLabel: { fontSize: 10, fontWeight: '900', color: '#00c853', letterSpacing: 1, marginBottom: 4 },
    geoText: { fontSize: 14, fontWeight: '600', color: text },

    mapBox: { borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: border, height: 340, backgroundColor: isLight ? '#e5e7eb' : '#111' },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    dim: { color: textMuted, fontSize: 13 },

    chipRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    chip: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: cardBg, borderWidth: 1, borderColor: border, alignItems: 'center' },
    chipOn: { borderColor: '#00c853', backgroundColor: isLight ? '#e8f5e9' : 'rgba(0,200,83,0.15)' },
    chipTxt: { fontSize: 11, fontWeight: '700', color: textMuted },
    chipTxtOn: { color: '#00c853' },

    pointsCard: { backgroundColor: cardBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: border, marginTop: 16 },
    pointsTitle: { fontSize: 10, fontWeight: '900', color: textMuted, letterSpacing: 1, marginBottom: 8 },
    pointRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: border },
    pointIdx: { fontSize: 11, fontWeight: '800', color: '#00c853', width: 60 },
    pointCoord: { fontSize: 12, color: text, fontFamily: 'monospace', flex: 1 },
    pointAcc: { fontSize: 11, color: textMuted },

    bigBtn: { backgroundColor: '#00c853', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginBottom: 10 },
    bigBtnSecondary: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#00c853' },
    bigBtnLabel: { fontSize: 14, fontWeight: '900', color: isLight ? '#fff' : '#000', letterSpacing: 1 },

    smallBtn: { paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: border, alignItems: 'center', marginTop: 4, backgroundColor: cardBg },
    smallBtnText: { fontSize: 12, fontWeight: '800', color: textMuted, letterSpacing: 1 },

    label: { fontSize: 10, fontWeight: '800', color: textMuted, marginTop: 16, marginBottom: 6, letterSpacing: 1 },
    input: { backgroundColor: cardBg, borderWidth: 1, borderColor: border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: text, fontSize: 15 },
    row: { flexDirection: 'row', gap: 12 },
    col: { flex: 1 },

    saveBtn: { backgroundColor: '#00c853', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 20 },
    saveBtnText: { fontSize: 15, fontWeight: '900', color: isLight ? '#fff' : '#000', letterSpacing: 1 },
    clearBtn: { paddingVertical: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#ff3b5c' },
    clearBtnText: { fontSize: 12, fontWeight: '900', color: '#ff3b5c', letterSpacing: 1 },
  });
};
