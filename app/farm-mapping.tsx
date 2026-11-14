import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import NetInfo from '@react-native-community/netinfo';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import FreeMap from '../src/components/FreeMap';
import FarmReceipt from '../src/components/FarmReceipt';
import { saveFarm, enclosedArea, pathLength, type FarmPoint } from '../src/utils/farms';
import { queueFarm } from '../src/utils/farmSync';

async function reverseGeocode(lat: number, lng: number) {
  try {
    const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
    if (!res.ok) return null;
    const d: any = await res.json();
    const admin: any[] = d.localityInfo?.administrative || [];
    return {
      state: d.principalSubdivision || admin.find((a) => a.adminLevel === 4)?.name || '',
      lga: d.city || admin.find((a) => a.adminLevel === 6)?.name || '',
      community: d.locality || admin.find((a) => a.adminLevel === 8)?.name || '',
      ward: admin.find((a) => a.adminLevel === 9)?.name || '',
    };
  } catch { return null; }
}

export default function FarmMapping() {
  const router = useRouter();
  const styles = createStyles();

  const [points, setPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [stateName, setStateName] = useState('');
  const [lga, setLga] = useState('');
  const [community, setCommunity] = useState('');
  const [ward, setWard] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [savedFarm, setSavedFarm] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  const viewShotRef = useRef<ViewShot>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => setIsOffline(!state.isConnected));
    return () => unsub();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 2000 },
        (loc) => {
          if (mounted) {
            setCurrentGPS({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
            setGpsAccuracy(loc.coords.accuracy ?? 999);
          }
        }
      );
    })();
    return () => { watcher.current?.remove(); };
  }, []);

  const dropPin = () => {
    if (!currentGPS) return Alert.alert('Wait', 'GPS not ready.');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints(prev => [...prev, currentGPS]);
    setIsClosed(false);
  };

  const closeLoop = () => {
    if (points.length < 3) return Alert.alert('Need 3 pins', 'Drop more pins.');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsClosed(true);
    setIsLocating(true);
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    
    reverseGeocode(lat, lng).then(d => {
      setIsLocating(false);
      if (d) {
        setStateName(d.state); setLga(d.lga); setCommunity(d.community); setWard(d.ward);
        if (!farmName) setFarmName(d.community ? d.community + ' Farm' : 'My Farm');
      }
    });
  };

  const save = async () => {
    if (!farmName.trim()) return Alert.alert('Name required', 'Enter a farm name.');
    if (!stateName.trim()) return Alert.alert('State required', 'Enter a state name.');
    setSaving(true);
    
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    const areaM2 = enclosedArea(points);
    const areaAcres = areaM2 / 4046.86;
    const areaHectares = areaM2 / 10000;
    const perimeter = pathLength(points);

    const farmData = {
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      state: stateName,
      lga: lga,
      community: community,
      ward: ward,
      centroid_lat: lat,
      centroid_lng: lng,
      boundary: points,
      area_m2: areaM2,
      area_acres: areaAcres,
      area_hectares: areaHectares,
      perimeter_m: perimeter,
    };

    const netState = await NetInfo.fetch();
    if (!netState.isConnected) {
      const queued = await queueFarm(farmData);
      setSaving(false);
      if (!queued) return Alert.alert('Error', 'Failed to save offline.');
      Alert.alert('📡 Saved Offline', 'Will sync when network returns.', [{ text: 'OK', onPress: () => router.replace('/farms') }]);
      return;
    }

    const { data, error } = await saveFarm(farmData);
    setSaving(false);
    if (error) return Alert.alert('Save failed', error);
    setSavedFarm({ ...data, ...farmData, acres: areaAcres, hectares: areaHectares, perimeter });
  };

  const shareReceipt = async () => {
    if (!viewShotRef.current) return;
    const uri = await viewShotRef.current.capture();
    if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/jpeg' });
  };

  const areaM2 = enclosedArea(points);
  const acres = areaM2 / 4046.86;
  const hectares = areaM2 / 10000;

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <FreeMap points={points} currentLocation={currentGPS} closed={isClosed} height={400} />
        <View style={styles.overlayTop}>
          <View style={styles.statBox}><Text style={styles.statVal}>{points.length}</Text><Text style={styles.statLbl}>PINS</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{acres.toFixed(2)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{hectares.toFixed(2)}</Text><Text style={styles.statLbl}>HECTARES</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.bottomPanel}>
        {isOffline && <View style={styles.offlineBanner}><Text style={styles.offlineText}>📡 OFFLINE MODE</Text></View>}
        
        <View style={styles.gpsRow}>
          <View style={[styles.gpsDot, { backgroundColor: gpsAccuracy && gpsAccuracy < 10 ? '#00ff88' : '#ffb300' }]} />
          <Text style={styles.gpsText}>GPS: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Searching...'}</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={dropPin} style={styles.pinBtn}><Text style={styles.pinBtnText}>📍 DROP PIN</Text></Pressable>
          {points.length >= 3 && !isClosed && (
            <Pressable onPress={closeLoop} style={[styles.pinBtn, { backgroundColor: '#ffb300' }]}>
              <Text style={[styles.pinBtnText, { color: '#000' }]}>🔗 CLOSE</Text>
            </Pressable>
          )}
        </View>

        <Text style={styles.label}>FARM NAME</Text>
        <TextInput value={farmName} onChangeText={setFarmName} style={styles.input} placeholder="e.g. North Field" placeholderTextColor="#666" />

        {isClosed && (
          <>
            <View style={styles.autofillBox}>
              <Text style={styles.autofillTitle}>📍 LOCATION DATA</Text>
              {isLocating ? <ActivityIndicator size="small" color="#00ff88" /> : (
                <>
                  {(stateName || lga) ? (
                    <Text style={styles.autofillText}>{community ? `${community}, ` : ''}{lga}, {stateName}</Text>
                  ) : (
                    <Text style={[styles.autofillText, { color: '#ffb300' }]}>Auto-detect failed. Fill manually below.</Text>
                  )}
                </>
              )}
              {(!stateName || !lga) && (
                <>
                  <TextInput value={stateName} onChangeText={setStateName} placeholder="State (e.g. Kaduna)" placeholderTextColor="#666" style={styles.inputSmall} />
                  <TextInput value={lga} onChangeText={setLga} placeholder="LGA (e.g. Zaria)" placeholderTextColor="#666" style={styles.inputSmall} />
                </>
              )}
            </View>
            <Pressable onPress={save} disabled={saving} style={styles.saveBtn}>
              {saving ? <ActivityIndicator color="#000" /> : <Text style={styles.saveBtnText}>SAVE & GENERATE MAP</Text>}
            </Pressable>
          </>
        )}
      </ScrollView>

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

      {/* RECEIPT MODAL */}
      <Modal visible={showReceipt} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <ScrollView>
              <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 1.0 }}>
                <FarmReceipt
                  farmName={farmName}
                  crop={crop}
                  state={stateName}
                  lga={lga}
                  community={community}
                  ward={ward}
                  points={points}
                  areaAcres={enclosedArea(points) / 4046.86}
                  perimeterM={pathLength(points)}
                  centroidLat={savedFarm?.centroid_lat}
                  centroidLng={savedFarm?.centroid_lng}
                  dateStr={new Date().toLocaleDateString()}
                  surveyorName="GAIA Agent"
                  mapSnapshotUri={snapshotUri}
                />
              </ViewShot>
              
              <Pressable 
                onPress={async () => {
                  try {
                    const uri = await viewShotRef.current?.capture();
                    if (uri) await Sharing.shareAsync(uri);
                  } catch (e) { Alert.alert('Error', 'Could not share receipt'); }
                }} 
                style={styles.shareBtn}
              >
                <Text style={styles.shareBtnText}>📥 DOWNLOAD / SHARE RECEIPT</Text>
              </Pressable>
              
              <Pressable 
                onPress={() => { setShowReceipt(false); router.replace('/farms'); }} 
                style={styles.closeBtn}
              >
                <Text style={styles.closeBtnText}>DONE</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = () => StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  mapContainer: { height: 400, width: '100%', position: 'relative' },
  overlayTop: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 16, padding: 12 },
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
  inputSmall: { backgroundColor: '#111', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, color: '#fff', fontSize: 13, marginTop: 8, borderWidth: 1, borderColor: '#333' },
  autofillBox: { backgroundColor: 'rgba(0,255,136,0.1)', padding: 16, borderRadius: 12, marginVertical: 12, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  autofillTitle: { fontSize: 10, fontWeight: '800', color: '#00ff88', letterSpacing: 1, marginBottom: 4 },
  autofillText: { fontSize: 14, color: '#fff', fontWeight: '600', marginTop: 2 },
  saveBtn: { backgroundColor: '#00ff88', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  offlineBanner: { backgroundColor: '#ff3b5c', padding: 10, borderRadius: 8, marginBottom: 12, alignItems: 'center' },
  offlineText: { color: '#fff', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center' },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  modalBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
