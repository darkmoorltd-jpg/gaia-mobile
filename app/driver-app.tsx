import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function DriverApp() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [scanCode, setScanCode] = useState('');
  const [batch, setBatch] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  const findBatch = async () => {
    if (!scanCode.trim()) return;
    setBusy(true);
    const { data } = await supabase.from('batches').select('*').eq('batch_code', scanCode.trim().toUpperCase()).maybeSingle();
    if (!data) Alert.alert('Not Found', 'Batch not found.');
    else setBatch(data);
    setBusy(false);
  };

  const acceptCargo = async () => {
    setBusy(true);
    await supabase.from('batches').update({ status: 'in_transit' }).eq('id', batch.id);
    await supabase.from('batch_movements').insert({
      batch_id: batch.id,
      driver_id: user.id,
      from_location: batch.location || 'Farm',
      to_location: 'In Transit',
      quantity_kg: batch.quantity_kg,
      status: 'in_transit'
    });
    setBusy(false);
    Alert.alert('Accepted', 'Cargo is now in transit. Drive safely.');
    setBatch(null);
    setScanCode('');
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Driver Logistics</Text>
        <Text style={styles.sub}>Scan to accept and deliver cargo.</Text>

        <View style={styles.scannerBox}>
          <Text style={styles.label}>BATCH CODE</Text>
          <TextInput value={scanCode} onChangeText={setScanCode} placeholder="e.g. GAI-2025-MZ-0001" style={styles.input} autoCapitalize="characters" />
          <Pressable onPress={findBatch} disabled={busy} style={styles.btn}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>FIND CARGO</Text>}
          </Pressable>
        </View>

        {batch ? (
          <View style={styles.card}>
            <Text style={styles.batchCode}>{batch.batch_code}</Text>
            <Text style={styles.crop}>{batch.crop_name} · {batch.quantity_kg}kg</Text>
            <Text style={styles.loc}>From: {batch.location || 'Farm'}</Text>
            
            <Pressable onPress={acceptCargo} disabled={busy} style={[styles.btn, { backgroundColor: '#ffb300', marginTop: 16 }]}>
              <Text style={styles.btnTxt}>🚚 ACCEPT CARGO</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  scannerBox: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#ffb300', marginBottom: 24 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginBottom: 8 },
  input: { backgroundColor: p.obsidian, padding: 16, borderRadius: 10, color: p.text, borderWidth: 1, borderColor: p.border, marginBottom: 16, fontSize: 18, letterSpacing: 2, textAlign: 'center' },
  btn: { backgroundColor: '#ffb300', padding: 16, borderRadius: 10, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  card: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.border },
  batchCode: { fontSize: 18, fontWeight: '900', color: p.text, fontFamily: 'monospace', textAlign: 'center' },
  crop: { fontSize: 14, color: p.textMuted, textAlign: 'center', marginTop: 8 },
  loc: { fontSize: 12, color: p.textDim, textAlign: 'center', marginTop: 4 },
});
