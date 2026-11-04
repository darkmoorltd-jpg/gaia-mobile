import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function ExporterDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [containerNum, setContainerNum] = useState('');
  const [port, setPort] = useState('Apapa, Lagos');

  const load = useCallback(async () => {
    setBusy(true);
    // Fetch batches available in storage
    const { data } = await supabase.from('batches').select('*').eq('status', 'in_storage').order('created_at', { ascending: false });
    setBatches(data || []);
    setBusy(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const createContainer = async () => {
    if (!containerNum.trim()) { Alert.alert('Enter container number'); return; }
    if (selectedIds.length === 0) { Alert.alert('Select at least 1 batch'); return; }
    setBusy(true);

    // 1. Create Container
    const { data: container, error } = await supabase.from('containers').insert({
      container_number: containerNum.toUpperCase(),
      exporter_id: user.id,
      departure_port: port,
      status: 'loading'
    }).select().single();

    if (error) { Alert.alert('Failed', error.message); setBusy(false); return; }

    // 2. Link Batches
    const links = selectedIds.map(id => ({ container_id: container.id, batch_id: id }));
    await supabase.from('container_batches').insert(links);

    // 3. Update Batches to 'exported'
    await supabase.from('batches').update({ status: 'exported' }).in('id', selectedIds);

    setBusy(false);
    setShowCreate(false);
    setSelectedIds([]);
    setContainerNum('');
    Alert.alert('Container Created', `Container ${containerNum} loaded with ${selectedIds.length} batches and marked for export.`);
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Exporter Dashboard</Text>
        <Text style={styles.sub}>Aggregate batches and generate EUDR compliance.</Text>

        <View style={styles.topBar}>
          <Text style={styles.selCount}>{selectedIds.length} selected</Text>
          <Pressable onPress={() => setShowCreate(true)} disabled={selectedIds.length === 0} style={[styles.btn, selectedIds.length === 0 && { opacity: 0.5 }]}>
            <Text style={styles.btnTxt}>📦 CREATE CONTAINER</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>AVAILABLE BATCHES (IN STORAGE)</Text>
        {busy ? <ActivityIndicator color="#3b82f6" /> : null}

        {batches.map(b => {
          const isSel = selectedIds.includes(b.id);
          return (
            <Pressable key={b.id} onPress={() => toggleSelect(b.id)} style={[styles.card, isSel && styles.cardActive]}>
              <View style={styles.checkbox}>
                {isSel ? <Text style={{ color: '#000', fontWeight: '900' }}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.batchCode}>{b.batch_code}</Text>
                <Text style={styles.crop}>{b.crop_name} · {b.quantity_kg}kg</Text>
                <Text style={styles.loc}>Grade {b.quality_grade} · {b.location}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* CREATE CONTAINER MODAL */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Create Container</Text>
            <Text style={styles.sub}>{selectedIds.length} batches selected</Text>

            <Text style={styles.label}>CONTAINER NUMBER</Text>
            <TextInput value={containerNum} onChangeText={setContainerNum} placeholder="e.g. MSKU-1234567" style={styles.input} autoCapitalize="characters" />

            <Text style={styles.label}>DEPARTURE PORT</Text>
            <TextInput value={port} onChangeText={setPort} style={styles.input} />

            <Pressable onPress={createContainer} disabled={busy} style={[styles.btn, { backgroundColor: '#3b82f6', marginTop: 16 }]}>
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnTxt, { color: '#fff' }]}>CONFIRM & EXPORT</Text>}
            </Pressable>
            <Pressable onPress={() => setShowCreate(false)} style={{ marginTop: 16, alignItems: 'center' }}>
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
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  selCount: { fontSize: 14, fontWeight: '800', color: '#3b82f6' },
  btn: { backgroundColor: p.neon, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  btnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginBottom: 12 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 10, gap: 12 },
  cardActive: { borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)' },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  batchCode: { fontSize: 15, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  crop: { fontSize: 13, color: p.text, marginTop: 4 },
  loc: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border },
});
