import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function TraceBatch() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);

  const trace = async () => {
    if (!code.trim()) return;
    setBusy(true);
    setResult(null);

    // 1. Fetch batch
    const { data: batch, error } = await supabase
      .from('batches')
      .select('*, batch_events(*)')
      .eq('batch_code', code.trim().toUpperCase())
      .maybeSingle();

    if (error || !batch) {
      Alert.alert('Not Found', 'No batch found with that code.');
      setBusy(false);
      return;
    }

    // 2. Fetch farmer profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('first_name, last_name, state, lga')
      .eq('user_id', batch.farmer_id)
      .maybeSingle();

    setResult({ ...batch, farmer: profile });
    setBusy(false);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Trace a Batch</Text>
        <Text style={styles.sub}>Enter a GAIA batch code to verify origin.</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="e.g. GAI-2025-CO-0001"
            placeholderTextColor={palette.textDim}
            style={[styles.input, { flex: 1 }]}
            autoCapitalize="characters"
          />
          <Pressable onPress={trace} disabled={busy} style={styles.btn}>
            {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.btnTxt}>TRACE</Text>}
          </Pressable>
        </View>

        {result ? (
          <View style={styles.resultBox}>
            <Text style={styles.badge}>✅ VERIFIED ORIGIN</Text>
            <Text style={styles.batchCode}>{result.batch_code}</Text>
            <Text style={styles.cropName}>{result.quantity_kg}kg of {result.crop_name}</Text>
            
            <Text style={styles.sectionLabel}>FARMER</Text>
            <Text style={styles.detail}>{result.farmer?.first_name} {result.farmer?.last_name}</Text>
            <Text style={styles.detail}>{result.farmer?.lga}, {result.farmer?.state}</Text>

            <Text style={styles.sectionLabel}>CHAIN OF CUSTODY</Text>
            {result.batch_events?.map((e: any, i: number) => (
              <View key={i} style={styles.timelineRow}>
                <View style={styles.dot} />
                <View>
                  <Text style={styles.eventType}>{e.event_type.toUpperCase()}</Text>
                  <Text style={styles.eventNotes}>{e.notes}</Text>
                  <Text style={styles.eventDate}>{new Date(e.created_at).toLocaleString()}</Text>
                </View>
              </View>
            ))}
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
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  btn: { backgroundColor: p.neon, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center' },
  btnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  resultBox: { backgroundColor: p.surface, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: p.neon },
  badge: { color: p.neon, fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
  batchCode: { fontSize: 22, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  cropName: { fontSize: 16, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5, marginTop: 20, marginBottom: 8 },
  detail: { fontSize: 14, color: p.text, marginBottom: 4 },
  timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.neon, marginTop: 4 },
  eventType: { fontSize: 12, fontWeight: '900', color: p.text },
  eventNotes: { fontSize: 13, color: p.textMuted, marginTop: 2 },
  eventDate: { fontSize: 10, color: p.textDim, marginTop: 4 },
});
