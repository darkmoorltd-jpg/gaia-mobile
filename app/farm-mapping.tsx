import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator, Modal, KeyboardAvoidingView, Platform,
} from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import FreeMap from '../src/components/FreeMap';
import FarmReceipt from '../src/components/FarmReceipt';
import { saveFarm, enclosedArea, pathLength, type FarmPoint } from '../src/utils/farms';

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
  } catch (e) { return null; }
}

export default function FarmMapping() {
  const router = useRouter();
  const styles = createStyles();

  const [points, setPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Form State
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [stateName, setStateName] = useState('');
  const [lga, setLga] = useState('');
  const [community, setCommunity] = useState('');
  const [ward, setWard] = useState('');
  
  // Receipt State
  const [saving, setSaving] = useState(false);
  const [savedFarm, setSavedFarm] = useState<any>(null);
  const viewShotRef = useRef<ViewShot>(null);

  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (perm.status !== 'granted') return;

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
      } catch (e) {}
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  const dropPin = () => {
    if (!currentGPS) return Alert.alert('Wait', 'GPS signal not ready.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints(prev => [...prev, currentGPS]);
    setIsClosed(false);
  };

  const closeLoop = () => {
    if (points.length < 3) return Alert.alert('Need 3 pins', 'Drop more pins.');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsClosed(true);
    
    // Auto-detect location from centroid
    setIsLocating(true);
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    
    reverseGeocode(lat, lng).then(d => {
      setIsLocating(false);
      if (d) {
        // Auto-fill everything!
        setStateName(d.state);
        setLga(d.lga);
        setCommunity(d.community);
        setWard(d.ward);
        if (!farmName) setFarmName(d.community ? d.community + ' Farm' : 'My Farm');
      }
    });
  };

  const save = async () => {
    if (!farmName.trim()) return Alert.alert('Name required', 'Enter a name for this farm.');
    setSaving(true);
    
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    const areaAcres = enclosedArea(points) / 4046.86;
    const perimeter = pathLength(points);

    const { data, error } = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      state: stateName,
      lga: lga,
      community: community,
      ward: ward,
      centroid_lat: lat,
      centroid_lng: lng,
      boundary: points,
    });

    setSaving(false);
    if (error) return Alert.alert('Save failed', error);

    // Show the receipt modal
    setSavedFarm({
      ...data,
      name: farmName,
      crop,
      state: stateName,
      lga,
      community,
      ward,
      centroid_lat: lat,
      centroid_lng: lng,
      acres: areaAcres,
      perimeter,
      boundary: points,
    });
  };

  const shareReceipt = async () => {
    try {
      if (!viewShotRef.current) return;
      const uri = await viewShotRef.current.capture();
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'image/jpeg', dialogTitle: 'Share Farm Survey' });
      }
    } catch (e) {
      Alert.alert('Error', 'Could not share receipt.');
    }
  };

  const acres = enclosedArea(points) / 4046.86;
  const perimeter = pathLength(points);

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <FreeMap points={points} currentLocation={currentGPS} closed={isClosed} height={400} />
        <View style={styles.overlayTop}>
          <View style={styles.statBox}><Text style={styles.statVal}>{points.length}</Text><Text style={styles.statLbl}>PINS</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{acres.toFixed(2)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{perimeter.toFixed(0)}m</Text><Text style={styles.statLbl}>PERIMETER</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.bottomPanel}>
        <View style={styles.gpsRow}>
          <View style={[styles.gpsDot, { backgroundColor: gpsAccuracy && gpsAccuracy < 10 ? '#00ff88' : '#ffb300' }]} />
          <Text style={styles.gpsText}>GPS: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Searching...'}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={dropPin} style={styles.pinBtn}><Text style={styles.pinBtnText}>📍 DROP PIN</Text></Pressable>
          {points.length >= 3 && !isClosed ? (
            <Pressable onPress={closeLoop} style={[styles.pinBtn, { backgroundColor: '#ffb300' }]}>
              <Text style={[styles.pinBtnText, { color: '#000' }]}>🔗 CLOSE</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.label}>FARM NAME</Text>
        <TextInput value={farmName} onChangeText={setFarmName} style={styles.input} placeholder="e.g. North Field" placeholderTextColor="#666" />
        
        <Text style={styles.label}>CROP (OPTIONAL)</Text>
        <TextInput value={crop} onChangeText={setCrop} style={styles.input} placeholder="e.g. Maize" placeholderTextColor="#666" />

        {isClosed && (
          <>
            <View style={styles.autofillBox}>
              <Text style={styles.autofillTitle}>📍 AUTO-DETECTED LOCATION</Text>
              {isLocating ? <ActivityIndicator size="small" color="#00ff88" /> : (
                <>
                  <Text style={styles.autofillText}>{community ? `${community}, ` : ''}{lga}, {stateName}</Text>
                  {ward ? <Text style={styles.autofillText}>Ward: {ward}</Text> : null}
                </>
              )}
            </View>

            <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE & GENERATE MAP</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* RECEIPT MODAL */}
      <Modal visible={!!savedFarm} transparent animationType="fade">
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
            <FarmReceipt ref={viewShotRef} farm={savedFarm} />
            
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24, width: '100%' }}>
              <Pressable onPress={() => { setSavedFarm(null); router.replace('/farms'); }} style={[styles.modalBtn, { backgroundColor: '#333' }]}>
                <Text style={[styles.modalBtnText, { color: '#fff' }]}>DONE</Text>
              </Pressable>
              <Pressable onPress={shareReceipt} style={[styles.modalBtn, { backgroundColor: '#00ff88' }]}>
                <Text style={styles.modalBtnText}>SHARE 📤</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { height: 400, width: '100%', position: 'relative' },
  overlayTop: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
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
  label: { fontSize: 11, color: '#888', fontWeight: '800', letterSpacing: 1.5, marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#222', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: '#fff', fontSize: 15, marginBottom: 10 },
  autofillBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, marginVertical: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  autofillTitle: { fontSize: 10, fontWeight: '800', color: '#00ff88', letterSpacing: 1, marginBottom: 4 },
  autofillText: { fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 2 },
  saveBtn: { backgroundColor: '#00ff88', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
