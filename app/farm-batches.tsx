import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import QRCode from 'react-native-qrcode-svg';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function FarmBatches() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [batches, setBatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [crop, setCrop] = useState('Maize');
  const [qty, setQty] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase
      .from('batches')
      .select('*, batch_events(*)')
      .eq('farmer_id', user.id)
      .order('created_at', { ascending: false });
    setBatches(data || []);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const createBatch = async () => {
    if (!qty || isNaN(Number(qty))) {
      Alert.alert('Error', 'Please enter a valid quantity.');
      return;
    }
    setBusy(true);
    
    // 1. Generate Code via RPC
    const { data: codeData } = await supabase.rpc('generate_batch_code', { crop });
    const batchCode = codeData || 'GAI-MANUAL-' + Date.now();
    
    // 2. Insert Batch
    const { data, error } = await supabase.from('batches').insert({
      batch_code: batchCode,
      farmer_id: user.id,
      crop_name: crop,
      quantity_kg: Number(qty),
      harvest_date: new Date().toISOString().split('T')[0],
      qr_url: `https://gaia.ng/trace/${batchCode}`
    }).select().single();

    if (error) {
      Alert.alert('Failed', error.message);
    } else {
      // 3. Insert initial event
      await supabase.from('batch_events').insert({
        batch_id: data.id,
        event_type: 'harvest',
        actor_id: user.id,
        notes: `Harvested ${qty}kg of ${crop}`
      });
      setShowCreate(false);
      setQty('');
      load();
    }
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Harvest Batches</Text>
        <Text style={styles.sub}>Create digital passports for your crops.</Text>

        <Pressable onPress={() => setShowCreate(true)} style={styles.cta}>
          <Text style={styles.ctaTxt}>+ CREATE NEW BATCH</Text>
        </Pressable>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {batches.map(b => (
          <Pressable key={b.id} onPress={() => setSelectedBatch(b)} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.batchCode}>{b.batch_code}</Text>
              <Text style={styles.batchCrop}>{b.crop_name} · {b.quantity_kg}kg</Text>
              <Text style={styles.batchDate}>Harvested: {b.harvest_date}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* CREATE MODAL */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>New Batch</Text>
            <Text style={styles.label}>CROP</Text>
            <TextInput value={crop} onChangeText={setCrop} style={styles.input} placeholder="e.g. Cocoa" />
            <Text style={styles.label}>QUANTITY (KG)</Text>
            <TextInput value={qty} onChangeText={setQty} keyboardType="number-pad" style={styles.input} placeholder="e.g. 500" />
            <Pressable onPress={createBatch} disabled={busy} style={styles.cta}>
              <Text style={styles.ctaTxt}>GENERATE BATCH</Text>
            </Pressable>
            <Pressable onPress={() => setShowCreate(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* QR MODAL */}
      <Modal visible={!!selectedBatch} animationType="fade" transparent>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { alignItems: 'center' }]}>
            <Text style={styles.title}>{selectedBatch?.batch_code}</Text>
            <Text style={[styles.sub, { textAlign: 'center', marginBottom: 20 }]}>
              Scan to trace this batch from farm to market.
            </Text>
            <View style={{ backgroundColor: '#fff', padding: 16, borderRadius: 16 }}>
              {selectedBatch && <QRCode value={selectedBatch.qr_url} size={200} />}
            </View>
            <Pressable onPress={() => setSelectedBatch(null)} style={[styles.cta, { width: '100%' }]}>
              <Text style={styles.ctaTxt}>CLOSE</Text>
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
  cta: { backgroundColor: p.neon, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  batchCode: { fontSize: 16, fontWeight: '900', color: p.neon, fontFamily: 'monospace' },
  batchCrop: { fontSize: 13, color: p.text, marginTop: 4, fontWeight: '600' },
  batchDate: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: p.textDim },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
});
