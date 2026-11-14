import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, Pressable, ActivityIndicator, Modal } from 'react-native';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import FreeMap from '../src/components/FreeMap';
import FarmReceipt from '../src/components/FarmReceipt';
import { generateFarmPdf } from '../src/utils/farmPdf';
import { saveFarm, enclosedArea, pathLength, type FarmPoint } from '../src/utils/farms';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const MAX_ACCURACY_M = 15; // Allow pin drop if within 15m
const GOOD_ACCURACY_M = 8; // Green indicator

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
  const { user } = useAuth();
  const styles = createStyles();

  const [points, setPoints] = useState<FarmPoint[]>([]);
  const [currentGPS, setCurrentGPS] = useState<FarmPoint | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  
  const [farmName, setFarmName] = useState('');
  const [crop, setCrop] = useState('');
  const [stateName, setStateName] = useState('');
  const [lga, setLga] = useState('');
  const [community, setCommunity] = useState('');
  const [ward, setWard] = useState('');
  
  const [saving, setSaving] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [snapshotUri, setSnapshotUri] = useState<string | null>(null);
  
  const viewShotRef = useRef<ViewShot>(null);
  const watcher = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      
      watcher.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, distanceInterval: 1, timeInterval: 2000 },
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
    if (gpsAccuracy && gpsAccuracy > MAX_ACCURACY_M) {
      return Alert.alert('Poor GPS Signal', `Accuracy is currently ±${gpsAccuracy.toFixed(0)}m. Please wait for it to drop below ${MAX_ACCURACY_M}m.`);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPoints(prev => [...prev, currentGPS]);
    setIsClosed(false);
  };

  const closeLoop = async () => {
    if (points.length < 3) return Alert.alert('Need 3 pins', 'Drop more pins.');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setIsClosed(true);
    
    // Calculate centroid to auto-fill location
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;
    
    const d = await reverseGeocode(lat, lng);
    if (d) {
      setStateName(d.state); setLga(d.lga); setCommunity(d.community); setWard(d.ward);
      if (!farmName) setFarmName(d.community ? d.community + ' Farm' : 'My Farm');
    }
  };

  const save = async () => {
    if (!farmName.trim()) return Alert.alert('Name required', 'Enter a name for this farm.');
    if (points.length < 3) return Alert.alert('Need more pins', 'Drop at least 3 pins.');
    
    setSaving(true);
    const lat = points.reduce((s, p) => s + p.latitude, 0) / points.length;
    const lng = points.reduce((s, p) => s + p.longitude, 0) / points.length;

    // 1. Fetch farmer details synchronously for the receipt
    let profile: any = null;
    try {
      if (user) {
        const { data } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
        profile = data;
      }
    } catch (e) { console.warn('Could not fetch profile', e); }

    // 2. Save farm to DB
    const result = await saveFarm({
      name: farmName.trim(),
      crop: crop.trim() || undefined,
      state: stateName,
      lga: lga,
      community: community,
      ward: ward,
      centroid_lat: lat,
      centroid_lng: lng,
      boundary: points,
      area_acres: enclosedArea(points) / 4046.86,
      perimeter_m: pathLength(points),
    });

    setSaving(false);
    if (result.error) { Alert.alert('Save failed', result.error); return; }

    // 3. Prepare receipt data (merging farm + farmer)
    setReceiptData({
      profile,
      farm: result.data,
      lat, lng,
    });
    setShowReceipt(true);
  };

  const accuracyColor = gpsAccuracy === null ? '#888' : gpsAccuracy <= GOOD_ACCURACY_M ? '#00ff88' : gpsAccuracy <= MAX_ACCURACY_M ? '#ffb300' : '#ff3b5c';

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <FreeMap points={points} currentLocation={currentGPS} closed={isClosed} height={400} />
        
        {/* Top Stats Banner */}
        <View style={styles.overlayTop}>
          <View style={styles.statBox}><Text style={styles.statVal}>{points.length}</Text><Text style={styles.statLbl}>PINS</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{(enclosedArea(points) / 4046.86).toFixed(2)}</Text><Text style={styles.statLbl}>ACRES</Text></View>
          <View style={styles.statBox}><Text style={styles.statVal}>{pathLength(points).toFixed(0)}m</Text><Text style={styles.statLbl}>PERIMETER</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.bottomPanel}>
        {/* GPS Status */}
        <View style={styles.gpsRow}>
          <View style={[styles.gpsDot, { backgroundColor: accuracyColor }]} />
          <Text style={styles.gpsText}>
            GPS Accuracy: {gpsAccuracy ? `±${gpsAccuracy.toFixed(0)}m` : 'Searching...'}
          </Text>
          {gpsAccuracy && gpsAccuracy > MAX_ACCURACY_M ? (
            <Text style={{ fontSize: 10, color: '#ff3b5c', fontWeight: '700' }}>WAIT FOR BETTER SIGNAL</Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <Pressable 
            onPress={dropPin} 
            style={[styles.pinBtn, (gpsAccuracy && gpsAccuracy > MAX_ACCURACY_M) && { opacity: 0.5 }]}
          >
            <Text style={styles.pinBtnText}>📍 DROP PIN</Text>
          </Pressable>
          
          {points.length >= 3 && !isClosed ? (
            <Pressable onPress={closeLoop} style={[styles.pinBtn, { backgroundColor: '#ffb300' }]}>
              <Text style={[styles.pinBtnText, { color: '#000' }]}>🔗 CLOSE</Text>
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

      {/* RECEIPT MODAL */}
      <Modal visible={showReceipt} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <ScrollView>
              {receiptData && (
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
                    centroidLat={receiptData.lat}
                    centroidLng={receiptData.lng}
                    dateStr={new Date().toLocaleDateString()}
                    surveyorName={receiptData.profile?.first_name ? `${receiptData.profile.first_name} ${receiptData.profile.last_name || ''}`.trim() : 'GAIA Agent'}
                    
                    farmerName={receiptData.profile?.first_name ? `${receiptData.profile.first_name} ${receiptData.profile.last_name || ''}`.trim() : user?.email}
                    farmerEmail={user?.email || ''}
                    farmerPhone={receiptData.profile?.phone || ''}
                    farmerAddress={
                      [
                        receiptData.profile?.street_address,
                        receiptData.profile?.city,
                        receiptData.profile?.lga,
                        receiptData.profile?.state
                      ].filter(Boolean).join(', ') || 'Address not set in profile'
                    }
                    mapSnapshotUri={snapshotUri}
                  />
                </ViewShot>
              )}
              
              <Pressable 
                onPress={async () => {
                  try {
                    const base64 = await viewShotRef.current?.capture({ format: 'jpg', quality: 0.9, result: 'base64' });
                    if (base64) await generateFarmPdf(base64, farmName);
                  } catch (e: any) { Alert.alert('Error', e.message || 'Could not generate PDF'); }
                }} 
                style={styles.shareBtn}
              >
                <Text style={styles.shareBtnText}>📥 DOWNLOAD PDF SURVEY</Text>
              </Pressable>
              
              <Pressable onPress={() => { setShowReceipt(false); router.replace('/farms'); }} style={styles.closeBtn}>
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
  saveBtn: { backgroundColor: '#00ff88', paddingVertical: 18, borderRadius: 14, alignItems: 'center', marginTop: 10 },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#000', letterSpacing: 1 },
  hintText: { textAlign: 'center', color: '#666', fontSize: 12, marginTop: 10, fontStyle: 'italic' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#fff', borderRadius: 20, padding: 10, maxHeight: '90%' },
  shareBtn: { backgroundColor: '#00ff88', paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  shareBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  closeBtn: { paddingVertical: 16, alignItems: 'center', marginTop: 10 },
  closeBtnText: { fontSize: 13, fontWeight: '800', color: '#666' },
});
