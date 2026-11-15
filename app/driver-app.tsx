import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal, Image, Linking, Platform } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { startBackgroundTracking, stopBackgroundTracking } from '../src/utils/backgroundLocation';

export default function DriverAppV3() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [tab, setTab] = useState<'jobs' | 'history' | 'scan'>('jobs');
  const [activeJobs, setActiveJobs] = useState<any[]>([]);
  const [historyJobs, setHistoryJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Modals
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [showDeliverModal, setShowDeliverModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  
  // Delivery Form
  const [actualWeight, setActualWeight] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [podPhoto, setPodPhoto] = useState<string | null>(null);

  // Expense Form
  const [expenseType, setExpenseType] = useState('Fuel');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePhoto, setExpensePhoto] = useState<string | null>(null);
  const [jobsExpenses, setJobsExpenses] = useState<Record<string, number>>({});

  // Scanner
  const [permission, requestPermission] = useCameraPermissions();

  // 1. Network Listener
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => setIsOffline(!state.isConnected));
    return () => unsub();
  }, []);

  // 2. Push Notifications Setup
  useEffect(() => {
    async function setupPush() {
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default', importance: Notifications.AndroidImportance.MAX,
        });
      }
      if (Device.isDevice && user) {
        const { status } = await Notifications.requestPermissionsAsync();
        if (status === 'granted') {
          try {
            const token = (await Notifications.getExpoPushTokenAsync()).data;
            await supabase.from('push_tokens').upsert({ user_id: user.id, token });
          } catch (e) {}
        }
      }
    }
    setupPush();
  }, [user]);

  useFocusEffect(useCallback(() => { fetchJobs(); }, [user]));

  const fetchJobs = async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from('batch_movements')
      .select('*, batches(*)')
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false });
      
    if (data) {
      setActiveJobs(data.filter(j => ['assigned', 'in_transit'].includes(j.status)));
      setHistoryJobs(data.filter(j => ['delivered', 'received'].includes(j.status)));
      
      // Load expenses for these jobs
      const { data: expData } = await supabase.from('trip_expenses').select('movement_id, amount_naira').eq('driver_id', user.id);
      if (expData) {
        const expMap: Record<string, number> = {};
        expData.forEach(e => { expMap[e.movement_id] = (expMap[e.movement_id] || 0) + Number(e.amount_naira); });
        setJobsExpenses(expMap);
      }
    }
    setBusy(false);
  };

  const acceptJob = async (movementId: string, batchId: string) => {
    if (isOffline) return Alert.alert('Offline', 'You need internet to accept a job.');
    setBusy(true);
    const started = await startBackgroundTracking();
    if (!started) return Alert.alert('Error', 'Background GPS failed.');
    await supabase.from('batch_movements').update({ status: 'in_transit', dispatched_at: new Date().toISOString() }).eq('id', movementId);
    await supabase.from('batches').update({ status: 'in_transit' }).eq('id', batchId);
    fetchJobs();
    setBusy(false);
  };

  const navigateTo = (job: any) => {
    const dest = encodeURIComponent(job.destination_location || 'Destination');
    Linking.openURL(Platform.OS === 'ios' ? `maps:0,0?q=${dest}` : `geo:0,0?q=${dest}`);
  };

  const triggerSOS = (job: any) => {
    Alert.alert('🚨 EMERGENCY', 'Send GPS location to Admin?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'SEND SOS', style: 'destructive', onPress: async () => {
        const loc = await Location.getCurrentPositionAsync({});
        await supabase.from('sos_alerts').insert({ driver_id: user.id, batch_id: job.batch_id, lat: loc.coords.latitude, lon: loc.coords.longitude });
        Alert.alert('SOS Sent', 'Admin has been alerted.');
      }}
    ]);
  };

  // --- EXPENSES ---
  const pickExpensePhoto = async () => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (!r.canceled) setExpensePhoto(r.assets[0].uri);
  };

  const saveExpense = async () => {
    if (!expenseAmount || !activeJob) return;
    setBusy(true);
    try {
      let url = null;
      if (expensePhoto) {
        const b64 = await FileSystem.readAsStringAsync(expensePhoto, { encoding: 'base64' as any });
        const path = `exp-${activeJob.id}-${Date.now()}.jpg`;
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        await supabase.storage.from('expense-receipts').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
        url = supabase.storage.from('expense-receipts').getPublicUrl(path).data.publicUrl;
      }
      await supabase.from('trip_expenses').insert({
        movement_id: activeJob.id, driver_id: user.id,
        expense_type: expenseType, amount_naira: parseFloat(expenseAmount), receipt_url: url
      });
      Alert.alert('Saved', 'Expense logged.');
      setShowExpenseModal(false);
      setExpenseAmount(''); setExpensePhoto(null);
      fetchJobs();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setBusy(false);
  };

  // --- DELIVERY ---
  const pickPod = async () => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled) setPodPhoto(r.assets[0].uri);
  };

  const submitDelivery = async () => {
    if (!activeJob || !podPhoto) return Alert.alert('Required', 'Proof of delivery required.');
    const expected = activeJob.batches.quantity_kg;
    const actual = parseFloat(actualWeight) || expected;
    const loss = expected - actual;
    
    if (loss > 0 && !lossReason) return Alert.alert('Required', 'Loss reason required.');

    setBusy(true);
    try {
      const b64 = await FileSystem.readAsStringAsync(podPhoto, { encoding: 'base64' as any });
      const path = `pod-${activeJob.id}-${Date.now()}.jpg`;
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      await supabase.storage.from('delivery-photos').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      const pub = supabase.storage.from('delivery-photos').getPublicUrl(path).data.publicUrl;

      await supabase.from('batch_movements').update({
        status: 'delivered', arrived_at: new Date().toISOString(),
        quantity_kg: actual, loss_kg: loss > 0 ? loss : 0, loss_reason: lossReason, pod_url: pub
      }).eq('id', activeJob.id);

      await supabase.from('batches').update({ status: 'delivered' }).eq('id', activeJob.batches.id);
      await stopBackgroundTracking();
      
      Alert.alert('Delivered', 'Cargo successfully delivered!');
      setShowDeliverModal(false);
      setPodPhoto(null); setActualWeight(''); setLossReason('');
      fetchJobs();
    } catch (e: any) { Alert.alert('Error', e.message); }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      {/* OFFLINE BANNER */}
      {isOffline ? (
        <View style={{ backgroundColor: '#ff3b5c', padding: 10, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>⚠️ NO INTERNET - SAVING TO OFFLINE QUEUE</Text>
        </View>
      ) : null}

      <View style={styles.header}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Portal</Text>
        
        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('jobs')} style={[styles.tabBtn, tab === 'jobs' && styles.tabBtnActive]}>
            <Text style={[styles.tabTxt, tab === 'jobs' && styles.tabTxtActive]}>ACTIVE</Text>
          </Pressable>
          <Pressable onPress={() => setTab('history')} style={[styles.tabBtn, tab === 'history' && styles.tabBtnActive]}>
            <Text style={[styles.tabTxt, tab === 'history' && styles.tabTxtActive]}>HISTORY</Text>
          </Pressable>
          <Pressable onPress={() => setTab('scan')} style={[styles.tabBtn, tab === 'scan' && styles.tabBtnActive]}>
            <Text style={[styles.tabTxt, tab === 'scan' && styles.tabTxtActive]}>SCAN</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/driver-earnings' as any)} style={styles.tabBtn}>
            <Text style={styles.tabTxt}>WALLET</Text>
          </Pressable>
        </View>
      </View>

      {tab === 'scan' ? (
        <View style={{ flex: 1 }}>
          {!permission?.granted ? (
            <View style={styles.center}><Pressable onPress={requestPermission} style={styles.btn}><Text style={styles.btnTxt}>GRANT CAMERA</Text></Pressable></View>
          ) : (
            <CameraView style={StyleSheet.absoluteFillObject} facing="back" onBarcodeScanned={({data}) => { setTab('jobs'); alert('Scanned: ' + data); }} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
          )}
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          {(tab === 'jobs' ? activeJobs : historyJobs).map((job) => {
            const b = job.batches;
            const isActive = job.status === 'in_transit';
            const isHistory = ['delivered', 'received'].includes(job.status);
            const tripExpense = jobsExpenses[job.id] || 0;
            const netPay = Number(job.delivery_fee || 0) - Number(job.gaia_commission || 0) - tripExpense;
            
            return (
              <View key={job.id} style={[styles.card, isActive && { borderColor: '#ffb300' }]}>
                <View style={styles.row}>
                  <Text style={styles.batchCode}>{b.batch_code}</Text>
                  <Text style={[styles.status, isHistory && { color: palette.textMuted }]}>{job.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.cargo}>{b.crop_name} · {b.quantity_kg}kg</Text>
                <Text style={styles.route}>📍 {job.origin_location} ➔ {job.destination_location}</Text>

                {isActive ? (
                  <View style={{ marginTop: 12 }}>
                    <View style={styles.actionRow}>
                      <Pressable onPress={() => navigateTo(job)} style={[styles.btn, { backgroundColor: '#3b82f6', flex: 1 }]}>
                        <Text style={styles.btnTxt}>🗺️ NAVIGATE</Text>
                      </Pressable>
                      <Pressable onPress={() => triggerSOS(job)} style={[styles.btn, { backgroundColor: '#ff3b5c', width: 80 }]}>
                        <Text style={[styles.btnTxt, { color: '#fff' }]}>🚨 SOS</Text>
                      </Pressable>
                    </View>
                    
                    <Pressable onPress={() => { setActiveJob(job); setShowExpenseModal(true); }} style={[styles.btn, { backgroundColor: '#333', marginTop: 8 }]}>
                      <Text style={styles.btnTxt}>⛽ ADD EXPENSE ({tripExpense.toLocaleString()} logged)</Text>
                    </Pressable>

                    <Pressable onPress={() => { setActiveJob(job); setShowDeliverModal(true); }} style={[styles.btn, { backgroundColor: palette.neon, marginTop: 8 }]}>
                      <Text style={styles.btnTxt}>✅ ARRIVED AT DESTINATION</Text>
                    </Pressable>
                  </View>
                ) : null}

                {job.status === 'assigned' ? (
                  <Pressable onPress={() => acceptJob(job.id, b.id)} style={[styles.btn, { backgroundColor: '#ffb300', marginTop: 16 }]}>
                    <Text style={styles.btnTxt}>🚚 ACCEPT & START TRIP</Text>
                  </Pressable>
                ) : null}

                {isHistory ? (
                  <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' }}>
                    <Text style={styles.meta}>Gross: ₦{Number(job.delivery_fee || 0).toLocaleString()}</Text>
                    <Text style={styles.meta}>Expenses: -₦{tripExpense.toLocaleString()}</Text>
                    <Text style={[styles.meta, { color: palette.neon, fontWeight: '900' }]}>Net: ₦{netPay.toLocaleString()}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* EXPENSE MODAL */}
      <Modal visible={showExpenseModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Expense</Text>
            <Text style={styles.label}>TYPE</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {['Fuel', 'Tolls', 'Police', 'Repairs'].map(t => (
                <Pressable key={t} onPress={() => setExpenseType(t)} style={{ flex: 1, padding: 10, backgroundColor: expenseType === t ? '#ffb300' : '#333', borderRadius: 8, alignItems: 'center' }}>
                  <Text style={{ color: expenseType === t ? '#000' : '#fff', fontSize: 11, fontWeight: '800' }}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.label}>AMOUNT (₦)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={expenseAmount} onChangeText={setExpenseAmount} placeholderTextColor="#666" />

            <Text style={styles.label}>RECEIPT PHOTO</Text>
            <Pressable onPress={pickExpensePhoto} style={styles.photoBtn}>
              {expensePhoto ? <Image source={{ uri: expensePhoto }} style={{ width: '100%', height: 80, borderRadius: 8 }} /> : <Text style={{ color: '#ffb300', fontWeight: '800' }}>📸 TAKE PHOTO</Text>}
            </Pressable>

            <Pressable onPress={saveExpense} disabled={busy} style={[styles.btn, { marginTop: 20 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>SAVE EXPENSE</Text>}
            </Pressable>
            <Pressable onPress={() => setShowExpenseModal(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* POD MODAL */}
      <Modal visible={showDeliverModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Delivery</Text>
            <Text style={styles.label}>ACTUAL WEIGHT (KG)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={actualWeight} onChangeText={setActualWeight} placeholder={`${activeJob?.batches?.quantity_kg}`} placeholderTextColor="#666" />

            {parseFloat(actualWeight) < (activeJob?.batches?.quantity_kg || 0) && actualWeight !== '' ? (
              <>
                <Text style={[styles.label, { color: '#ff3b5c' }]}>LOSS REASON</Text>
                <TextInput style={styles.input} value={lossReason} onChangeText={setLossReason} placeholderTextColor="#666" />
              </>
            ) : null}

            <Text style={styles.label}>PROOF OF DELIVERY *</Text>
            <Pressable onPress={pickPod} style={styles.photoBtn}>
              {podPhoto ? <Image source={{ uri: podPhoto }} style={{ width: '100%', height: 100, borderRadius: 8 }} /> : <Text style={{ color: '#ffb300', fontWeight: '800' }}>📸 PHOTO WITH RECEIVER</Text>}
            </Pressable>

            <Pressable onPress={submitDelivery} disabled={busy} style={[styles.btn, { marginTop: 20 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>CONFIRM DELIVERY</Text>}
            </Pressable>
            <Pressable onPress={() => setShowDeliverModal(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#888' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { padding: 20, paddingTop: 60, backgroundColor: p.obsidian },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 20 },
  tabBar: { flexDirection: 'row', gap: 6 },
  tabBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: p.surface, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  tabBtnActive: { backgroundColor: p.neon, borderColor: p.neon },
  tabTxt: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  tabTxtActive: { color: '#000' },
  scroll: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  batchCode: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  status: { fontSize: 10, fontWeight: '900', color: p.neon },
  cargo: { fontSize: 14, color: p.textMuted },
  route: { fontSize: 12, color: p.textDim, marginTop: 8 },
  actionRow: { flexDirection: 'row', gap: 8 },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#222', padding: 20, borderRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
  photoBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#ffb300', borderStyle: 'dashed', alignItems: 'center', backgroundColor: 'rgba(255,179,0,0.1)' },
});
