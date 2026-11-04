import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function WarehouseManager() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [batches, setBatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [scanCode, setScanCode] = useState('');
  const [selected, setSelected] = useState<any | null>(null);
  const [receivedKg, setReceivedKg] = useState('');
  const [lossReason, setLossReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    // Fetch all batches that are NOT yet in storage (in transit to us)
    const { data } = await supabase
      .from('batches')
      .select('*')
      .in('status', ['active', 'in_transit'])
      .order('created_at', { ascending: false });
    setBatches(data || []);
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openBatch = () => {
    if (!scanCode.trim()) return;
    const found = batches.find(b => b.batch_code === scanCode.trim().toUpperCase());
    if (!found) {
      Alert.alert('Not Found', 'No incoming batch found with that code.');
      return;
    }
    setSelected(found);
    setReceivedKg(String(found.quantity_kg)); // Default to full quantity
  };

  const confirmReceive = async () => {
    if (!receivedKg || isNaN(Number(receivedKg))) { Alert.alert('Enter valid kg'); return; }
    setProcessing(true);

    const loss = Number(selected.quantity_kg) - Number(receivedKg);
    const lossReasonText = loss > 0 ? (lossReason.trim() || 'Transit loss') : null;

    // 1. Update Batch Status to 'in_storage'
    await supabase.from('batches').update({ status: 'in_storage' }).eq('id', selected.id);

    // 2. Log the movement
    await supabase.from('batch_movements').insert({
      batch_id: selected.id,
      from_location: selected.location || 'Farm',
      to_location: 'Warehouse',
      quantity_kg: Number(receivedKg),
      loss_kg: loss > 0 ? loss : 0,
      loss_reason: lossReasonText,
      arrived_at: new Date().toISOString()
    });

    // 3. Log the event
    await supabase.from('batch_events').insert({
      batch_id: selected.id,
      event_type: 'warehouse_receive',
      notes: `Received ${receivedKg}kg. Loss: ${loss}kg ${lossReasonText ? '(' + lossReasonText + ')' : ''}`,
    });

    setProcessing(false);
    setSelected(null);
    setScanCode('');
    setReceivedKg('');
    setLossReason('');
    Alert.alert('Success', 'Batch received and logged into warehouse.');
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <Text style={styles.title}>Warehouse Manager</Text>
        <Text style={styles.sub}>Receive incoming harvest batches.</Text>

        <View style={styles.scannerBox}>
          <Text style={styles.label}>SCAN OR ENTER BATCH CODE</Text>
          <TextInput 
            value={scanCode} 
            onChangeText={setScanCode} 
            placeholder="e.g. GAI-2025-MZ-0001" 
            placeholderTextColor="#888" 
            style={styles.input} 
            autoCapitalize="characters"
          />
          <Pressable onPress={openBatch} style={styles.btn}>
            <Text style={styles.btnTxt}>RECEIVE BATCH</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>INCOMING TRUCKS ({batches.length})</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {batches.map(b => (
          <Pressable key={b.id} onPress={() => { setSelected(b); setReceivedKg(String(b.quantity_kg)); }} style={styles.card}>
            <View>
              <Text style={styles.batchCode}>{b.batch_code}</Text>
              <Text style={styles.crop}>{b.crop_name} · {b.quantity_kg}kg expected</Text>
              <Text style={styles.loc}>From: {b.location || 'Unknown Farm'}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* RECEIVE MODAL */}
      <Modal visible={!!selected} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Receive Batch</Text>
            <Text style={styles.sub}>{selected?.batch_code} · {selected?.crop_name}</Text>

            <View style={styles.statRow}>
              <Text style={styles.statLbl}>EXPECTED WEIGHT</Text>
              <Text style={styles.statVal}>{selected?.quantity_kg} kg</Text>
            </View>

            <Text style={styles.label}>ACTUAL RECEIVED WEIGHT (KG)</Text>
            <TextInput 
              value={receivedKg} 
              onChangeText={setReceivedKg} 
              keyboardType="numeric" 
              style={styles.input} 
            />

            {Number(receivedKg) < Number(selected?.quantity_kg) ? (
              <>
                <Text style={[styles.label, { color: '#ff3b5c' }]}>
                  LOSS: {Number(selected?.quantity_kg) - Number(receivedKg)} KG
                </Text>
                <TextInput 
                  value={lossReason} 
                  onChangeText={setLossReason} 
                  placeholder="Reason for loss (e.g. spillage, moisture, theft)" 
                  placeholderTextColor="#888" 
                  style={styles.input} 
                />
              </>
            ) : null}

            <Pressable onPress={confirmReceive} disabled={processing} style={styles.btn}>
              {processing ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>CONFIRM RECEIPT</Text>}
            </Pressable>
            
            <Pressable onPress={() => setSelected(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  scannerBox: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.neon, marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 12, marginBottom: 6, letterSpacing: 1 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  btn: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginBottom: 12 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  batchCode: { fontSize: 15, fontWeight: '900', color: p.neon, fontFamily: 'monospace' },
  crop: { fontSize: 14, fontWeight: '600', color: p.text, marginTop: 4 },
  loc: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, marginBottom: 16 },
  statLbl: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  statVal: { fontSize: 20, fontWeight: '900', color: p.text },
});
