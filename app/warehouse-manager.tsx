import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal, Image } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import NotificationBell from '../src/components/NotificationBell';
import { usePushRegistration } from '../src/hooks/usePushRegistration';
import { initiateDriverPayout } from '../src/utils/payouts';

export default function WarehouseManager() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  usePushRegistration(user);
  const styles = createStyles(palette);

  const [incoming, setIncoming] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  // Modal
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const [finalWeight, setFinalWeight] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    // Find jobs marked 'delivered' by the driver, awaiting receiver confirmation
    const { data } = await supabase.from('batch_movements')
      .select('*, batches(batch_code, crop_name), driver_profiles(license_number, user_profiles(first_name, last_name))')
      .eq('status', 'delivered')
      .eq('payout_status', 'pending');
    if (data) setIncoming(data);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pickSignature = async () => {
    const r = await ImagePicker.launchCameraAsync({ quality: 0.6 });
    if (!r.canceled) setSignature(r.assets[0].uri);
  };

  const confirmReceipt = async () => {
    if (!selectedJob || !signature || !finalWeight) {
      return Alert.alert('Missing', 'Please enter weight and take a signature photo.');
    }

    setBusy(true);
    try {
      // 1. Upload signature
      const base64 = await FileSystem.readAsStringAsync(signature, { encoding: 'base64' as any });
      const path = `sign-${selectedJob.id}-${Date.now()}.jpg`;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      await supabase.storage.from('receiver-signatures').upload(path, bytes.buffer, { contentType: 'image/jpeg' });
      const { data: pub } = supabase.storage.from('receiver-signatures').getPublicUrl(path);

      // 2. Update batch_movements
      await supabase.from('batch_movements').update({
        status: 'received',
        receiver_id: user.id,
        receiver_weight_kg: parseFloat(finalWeight),
        receiver_signature_url: pub.publicUrl,
        received_at: new Date().toISOString(),
      }).eq('id', selectedJob.id);

      // 3. Trigger payout (test mode by default; set ENABLE_REAL_PAYOUTS=true on Supabase to move money)
      const pay = await initiateDriverPayout(selectedJob.id);
      if (!pay.ok) {
        Alert.alert('Delivery logged, but payout failed', pay.error || 'Try again from the driver payout screen.');
      }

      Alert.alert('Confirmed', 'Cargo received. Driver payout is being processed.');
      setShowModal(false);
      setSignature(null);
      setFinalWeight('');
      load();
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
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={styles.title}>Incoming Deliveries</Text>
          <NotificationBell />
        </View>

        {busy && incoming.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}
        {incoming.length === 0 && !busy ? <Text style={styles.empty}>No cargo awaiting confirmation.</Text> : null}

        {incoming.map((job) => (
          <View key={job.id} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.batchCode}>{job.batches?.batch_code}</Text>
              <Text style={styles.status}>ARRIVED</Text>
            </View>
            <Text style={styles.meta}>Crop: {job.batches?.crop_name}</Text>
            <Text style={styles.meta}>Expected: {job.batches?.quantity_kg}kg</Text>
            <Text style={styles.meta}>Driver entered: {job.quantity_kg}kg</Text>
            <Text style={styles.meta}>Driver: {job.driver_profiles?.user_profiles?.first_name} ({job.driver_profiles?.license_number})</Text>

            <Pressable onPress={() => { setSelectedJob(job); setFinalWeight(String(job.quantity_kg || '')); setShowModal(true); }} style={[styles.btn, { marginTop: 16 }]}>
              <Text style={styles.btnTxt}>📝 CONFIRM RECEIPT</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>

      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Delivery</Text>
            <Text style={styles.meta}>Driver weight: {selectedJob?.quantity_kg}kg</Text>

            <Text style={styles.label}>VERIFIED WEIGHT (KG)</Text>
            <TextInput style={styles.input} keyboardType="numeric" value={finalWeight} onChangeText={setFinalWeight} placeholderTextColor="#666" />

            <Text style={styles.label}>RECEIVER SIGNATURE PHOTO *</Text>
            <Pressable onPress={pickSignature} style={styles.photoBtn}>
              {signature ? <Image source={{ uri: signature }} style={{ width: '100%', height: 100, borderRadius: 8 }} /> : <Text style={{ color: '#ffb300', fontWeight: '800' }}>📸 TAKE PHOTO OF SIGNED WAYBILL</Text>}
            </Pressable>

            <Pressable onPress={confirmReceipt} disabled={busy} style={[styles.btn, { marginTop: 20 }]}>
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>CONFIRM & RELEASE PAYMENT</Text>}
            </Pressable>
            <Pressable onPress={() => setShowModal(false)} style={{ marginTop: 16, alignItems: 'center' }}>
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
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, marginBottom: 20 },
  empty: { color: p.textMuted, fontStyle: 'italic', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, marginBottom: 16, borderWidth: 1, borderColor: p.border },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  batchCode: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  status: { fontSize: 10, fontWeight: '900', color: '#ffb300' },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  btn: { backgroundColor: p.neon, paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#222', padding: 20, borderRadius: 16 },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
  photoBtn: { padding: 16, borderRadius: 10, borderWidth: 1, borderColor: '#ffb300', borderStyle: 'dashed', alignItems: 'center', backgroundColor: 'rgba(255,179,0,0.1)' },
});
