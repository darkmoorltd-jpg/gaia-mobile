import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Switch, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Location from 'expo-location';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const GPS_INTERVAL_MS = 60_000;

export default function DriverApp() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [jobs, setJobs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState<string | null>(null); // stores batch_id currently tracking
  const intervalRef = useRef<any>(null);

  // Delivery Modal State
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [actualWeight, setActualWeight] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [showDeliverModal, setShowDeliverModal] = useState(false);

  useFocusEffect(React.useCallback(() => { fetchJobs(); }, [user]));

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const fetchJobs = async () => {
    if (!user) return;
    setBusy(true);
    // Fetch jobs assigned to this driver that are 'assigned' or 'in_transit'
    const { data } = await supabase.from('batch_movements')
      .select('*, batches(*)')
      .eq('driver_id', user.id)
      .in('status', ['assigned', 'in_transit']);
    if (data) setJobs(data);
    setBusy(false);
  };

  const logLocation = async (batchId: string) => {
    try {
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      await supabase.from('driver_locations').insert({
        batch_id: batchId,
        driver_id: user.id,
        lat: loc.coords.latitude,
        lon: loc.coords.longitude,
        speed_kmh: loc.coords.speed ? loc.coords.speed * 3.6 : null,
        heading_deg: loc.coords.heading || null,
        accuracy_m: loc.coords.accuracy || null,
      });
    } catch (e) {}
  };

  const toggleTracking = async (batchId: string) => {
    if (tracking === batchId) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTracking(null);
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Permission denied', 'GPS is required.');
    
    setTracking(batchId);
    logLocation(batchId);
    intervalRef.current = setInterval(() => logLocation(batchId), GPS_INTERVAL_MS);
    Alert.alert('Tracking Started', 'Your location is being sent to the exporter.');
  };

  const acceptJob = async (movementId: string, batchId: string) => {
    setBusy(true);
    await supabase.from('batch_movements').update({ status: 'in_transit', dispatched_at: new Date().toISOString() }).eq('id', movementId);
    await supabase.from('batches').update({ status: 'in_transit' }).eq('id', batchId);
    await fetchJobs();
    setBusy(false);
  };

  const submitDelivery = async () => {
    if (!activeJob) return;
    const expected = activeJob.batches.quantity_kg;
    const actual = parseFloat(actualWeight) || expected;
    const loss = expected - actual;
    
    if (loss > 0 && !lossReason) {
      return Alert.alert('Loss Reason Required', 'Please state why the cargo weight reduced.');
    }

    setBusy(true);
    try {
      await supabase.from('batch_movements').update({
        status: 'delivered',
        arrived_at: new Date().toISOString(),
        quantity_kg: actual,
        loss_kg: loss > 0 ? loss : 0,
        loss_reason: lossReason,
      }).eq('id', activeJob.id);

      await supabase.from('batches').update({ status: 'delivered' }).eq('id', activeJob.batches.id);
      
      Alert.alert('Delivered', 'Cargo successfully delivered!');
      setShowDeliverModal(false);
      fetchJobs();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Dispatch Board</Text>
        <Text style={styles.sub}>Manage your assigned cargo and track deliveries.</Text>

        {busy && jobs.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}

        {jobs.length === 0 && !busy ? (
           <Text style={styles.empty}>No active jobs. Waiting for dispatch from Exporter or Warehouse.</Text>
        ) : null}

        {jobs.map((job) => {
          const b = job.batches;
          const isActive = job.status === 'in_transit';
          return (
            <View key={job.id} style={[styles.card, isActive && { borderColor: '#ffb300' }]}>
              <View style={styles.row}>
                <Text style={styles.batchCode}>{b.batch_code}</Text>
                <Text style={styles.status}>{job.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cargo}>{b.crop_name} · {b.quantity_kg}kg</Text>
              
              <View style={styles.routeBox}>
                <Text style={styles.route}>📍 FROM: {job.origin_location || 'Farm'}</Text>
                <Text style={styles.route}>🏁 TO: {job.destination_location || 'Market'}</Text>
              </View>

              {job.status === 'assigned' ? (
                <Pressable onPress={() => acceptJob(job.id, b.id)} style={[styles.btn, { backgroundColor: '#ffb300', marginTop: 16 }]}>
                  <Text style={styles.btnTxt}>🚚 ACCEPT & START TRIP</Text>
                </Pressable>
              ) : null}

              {isActive ? (
                <View style={{ marginTop: 16 }}>
                  <View style={styles.trackRow}>
                    <Text style={{ color: '#ffb300', fontWeight: '800' }}>Live GPS Tracking</Text>
                    <Switch value={tracking === b.id} onValueChange={() => toggleTracking(b.id)} trackColor={{ false: '#333', true: '#ffb300' }} />
                  </View>
                  <Pressable onPress={() => { setActiveJob(job); setShowDeliverModal(true); }} style={[styles.btn, { backgroundColor: palette.neon, marginTop: 12 }]}>
                    <Text style={styles.btnTxt}>✅ ARRIVED AT DESTINATION</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      {/* DELIVERY & LOSS TRACKING MODAL */}
      <Modal visible={showDeliverModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Complete Delivery</Text>
            <Text style={styles.meta}>Expected: {activeJob?.batches?.quantity_kg}kg</Text>
            
            <Text style={styles.label}>ACTUAL WEIGHT RECEIVED (KG)</Text>
            <TextInput 
              style={styles.input} keyboardType="numeric" 
              value={actualWeight} onChangeText={setActualWeight} 
              placeholder={`e.g. ${activeJob?.batches?.quantity_kg}`} placeholderTextColor="#666"
            />

            {parseFloat(actualWeight) < (activeJob?.batches?.quantity_kg || 0) && actualWeight !== '' ? (
              <>
                <Text style={[styles.label, { color: '#ff3b5c' }]}>LOSS REASON</Text>
                <TextInput 
                  style={styles.input} value={lossReason} onChangeText={setLossReason} 
                  placeholder="e.g. Spillage, Rain damage" placeholderTextColor="#666"
                />
              </>
            ) : null}

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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  empty: { textAlign: 'center', color: p.textMuted, marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  batchCode: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  status: { fontSize: 10, fontWeight: '900', color: p.neon },
  cargo: { fontSize: 14, color: p.textMuted },
  routeBox: { marginTop: 12, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 8 },
  route: { fontSize: 12, color: p.text, marginVertical: 2 },
  trackRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: 'rgba(255,179,0,0.1)', borderRadius: 8 },
  btn: { backgroundColor: p.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#222', padding: 20, borderRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 16 },
  meta: { color: '#aaa', marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
});
