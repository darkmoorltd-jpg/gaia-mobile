import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import FreeMap from '../src/components/FreeMap';
import {
  saveFarm, enclosedArea, pathLength,
  type FarmPoint,
} from '../src/utils/farms';

type ViewMode = 'satellite' | 'standard';

interface DetectedLocation {
  state: string; lga: string; community: string; ward: string;
}

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
    return { state, lga, community, ward };
  } catch (e) {
    return null;
  }
}

export default function FarmMapping() {
  const router = useRouter();
  const [isLight, setIsLight] = useState(false);
  const styles = createStyles(isLight);

  const [points, setPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [permission, setPermission] = useState(false);
  const [detected, setDetected] = useState<DetectedLocation | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);

  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [saving, setSaving] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;
        if (mounted) setPermission(true);

        watcher.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 2000 },
          (loc) => {
            if (mounted) {
              const p = { latitude: loc.coords.latitude, longitude: loc.coords.longitude, accuracy: loc.coords.accuracy ?? 999 };
              setCurrentGPS(p);
              setGpsAccuracy(loc.coords.accuracy ?? 999);
            }
          }
        );
      } catch (e) {
        Alert.alert('GPS Error', 'Could not start location tracking.');
      }
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  const dropPin = () => {
    if (!currentGPS) {
      Alert.alert('Wait for GPS', 'Waiting for accurate GPS signal.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints(prev => [...prev, currentGPS]);
    setIsClosed(false);
  };

  const closeLoop = () => {
    if (points.length < 3) {
      Alert.alert('Need 3 points', 'You need at least 3 pins to close a farm boundary.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsClosed(true);
    // Auto-detect location from first pin
    const first = points[0];
    reverseGeocode(first.latitude, first.longitude).then(d => {
      if (d) setDetected(d);
    });
  };

  const resetPath = () => {
    Alert.alert('Clear map?', 'This will delete all pins.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => {
        setPoints([]);
        setIsClosed(false);
        setDetected(null);
      }},
    ]);
  };

  const save = async () => {
    if (!farmName.trim()) { Alert.alert('Name required', 'Enter a name for this farm.'); return; }
    if (points.length < 3) { Alert.alert('Need more pins', 'Drop at least 3 pins.'); return; }
    
    setSaving(true);
    
    // If not closed, force close it now
    const finalBoundary = points;

    const { error } = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      state: detected?.state || '',
      lga: detected?.lga || '',
      community: detected?.community || '',
      ward: detected?.ward || '',
      centroid_lat: points.reduce((s, p) => s + p.latitude, 0) / points.length,
      centroid_lng: points.reduce((s, p) => s + p.longitude, 0) / points.length,
      boundary: finalBoundary,
    });

    setSaving(false);
    if (error) { Alert.alert('Save failed', error); return; }
    Alert.alert('Saved', 'Farm boundary successfully mapped.', [
      { text: 'OK', onPress: () => router.replace('/farms') },
    ]);
  };

  // Live calculations
  const acres = enclosedArea(points) / 4046.86;
  const perimeter = pathLength(points);

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <FreeMap
          points={points}
          currentLocation={currentGPS}
          closed={isClosed}
          height={400}
        />
        
        {/* Top Banner Overlay */}
        <View style={styles.overlayTop}>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{points.length}</Text>
            <Text style={styles.statLbl}>PINS</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{acres.toFixed(2)}</Text>
            <Text style={styles.statLbl}>ACRES</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statVal}>{perimeter.toFixed(0)}m</Text>
            <Text style={styles.statLbl}>PERIMETER</Text>
          </View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.bottomPanel}>
        {/* GPS Status */}
        <View style={styles.gpsRow}>
          <View style={[styles.gpsDot, { backgroundColor: gpsAccuracy && gpsAccuracy < 10 ? '#00ff88' : gpsAccuracy && gpsAccuracy < 25 ? '#ffb300' : '#ff3b5c' }]} />
          <Text style={styles.gpsText}>
            GPS: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Searching...'}
          </Text>
          {detected ? (
             <Text style={styles.gpsText} numberOfLines={1}>
               · {detected.community || detected.lga}, {detected.state}
             </Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable onPress={dropPin} style={styles.pinBtn}>
            <Text style={styles.pinBtnText}>📍 DROP PIN</Text>
          </Pressable>
          
          {points.length >= 3 && !isClosed ? (
            <Pressable onPress={closeLoop} style={[styles.pinBtn, { backgroundColor: '#ffb300' }]}>
              <Text style={[styles.pinBtnText, { color: '#000' }]}>🔗 CLOSE</Text>
            </Pressable>
          ) : null}

          {points.length > 0 ? (
            <Pressable onPress={resetPath} style={styles.resetBtn}>
              <Text style={styles.resetBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Form */}
        <Text style={styles.label}>FARM NAME</Text>
        <TextInput value={farmName} onChangeText={setFarmName} placeholder="e.g. North Field" placeholderTextColor="#666" style={styles.input} />
        
        <Text style={styles.label}>CROP (OPTIONAL)</Text>
        <TextInput value={crop} onChangeText={setCrop} placeholder="e.g. Maize" placeholderTextColor="#666" style={styles.input} />

        <View style={{ height: 20 }} />

        {isClosed ? (
          <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE FARM</Text>}
          </Pressable>
        ) : (
           <Text style={styles.hintText}>Drop at least 3 pins and tap CLOSE to save.</Text>
        )}

      </ScrollView>
    </View>
  );
}

const createStyles = (isLight: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { height: 400, width: '100%', position: 'relative' },
  overlayTop: {
    position: 'absolute', top: 50, left: 20, right: 20,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  statBox: { alignItems: 'center', flex: 1 },
  statVal: { fontSize: 22, fontWeight: '900', color: '#00ff88' },
  statLbl: { fontSize: 10, color: '#fff', fontWeight: '700', marginTop: 2 },
  
  bottomPanel: { padding: 20, backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, marginTop: -20 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 8 },
  gpsDot: { width: 10, height: 10, borderRadius: 5 },
  gpsText: { fontSize: 12, color: '#aaa', fontWeight: '600' },
  
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  pinBtn: { flex: 1, backgroundColor: '#00ff88', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  pinBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
  resetBtn: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 14, backgroundColor: '#222', alignItems: 'center', justifyContent: 'center' },
  resetBtnText: { fontSize: 13, color: '#ff3b5c', fontWeight: '700' },

  label: { fontSize: 11, color: '#888', fontWeight: '800', letterSpacing: 1.5, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, marginBottom: 10 },
  
  saveBtn: { backgroundColor: '#00ff88', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  hintText: { textAlign: 'center', color: '#666', fontSize: 12, marginTop: 10, fontStyle: 'italic' },
});
