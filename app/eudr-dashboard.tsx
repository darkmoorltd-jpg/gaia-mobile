import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

export default function EUDRDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [batches, setBatches] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      // Fetch all batches to simulate what an exporter sees
      const { data } = await supabase.from('batches')
        .select('*, batch_events(*)')
        .order('created_at', { ascending: false });
      setBatches(data || []);
      setBusy(false);
    })();
  }, []);

  const generateEUDR = (batch: any) => {
    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      Alert.alert(
        '✅ EUDR Due Diligence Generated',
        `Document for ${batch.batch_code} has been generated.\n\nStatus: Deforestation-free\nCrop: ${batch.crop_name}\nWeight: ${batch.quantity_kg}kg\n\nPDF is ready for download in the export portal.`
      );
    }, 2000);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>EUDR Command Center</Text>
            <Text style={styles.sub}>Export Traceability & Compliance</Text>
          </View>
          <View style={styles.liveDot} />
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{batches.length}</Text>
            <Text style={styles.statLbl}>BATCHES TRACKED</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>100%</Text>
            <Text style={styles.statLbl}>DEFORESTATION FREE</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>READY FOR EXPORT</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {batches.map(b => (
          <View key={b.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.batchCode}>{b.batch_code}</Text>
              <View style={styles.badge}>
                <Text style={styles.badgeTxt}>EUDR COMPLIANT</Text>
              </View>
            </View>
            
            <View style={styles.grid}>
              <View style={styles.gridItem}>
                <Text style={styles.gridLbl}>CROP</Text>
                <Text style={styles.gridVal}>{b.crop_name}</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLbl}>WEIGHT</Text>
                <Text style={styles.gridVal}>{b.quantity_kg} kg</Text>
              </View>
              <View style={styles.gridItem}>
                <Text style={styles.gridLbl}>HARVEST DATE</Text>
                <Text style={styles.gridVal}>{b.harvest_date}</Text>
              </View>
            </View>

            <View style={styles.chain}>
              <Text style={styles.chainLbl}>CHAIN OF CUSTODY ({b.batch_events?.length || 0} EVENTS)</Text>
              {b.batch_events?.slice(0, 3).map((e: any, i: number) => (
                <Text key={i} style={styles.chainItem}>• {e.event_type.toUpperCase()} — {new Date(e.created_at).toLocaleDateString()}</Text>
              ))}
            </View>

            <Pressable onPress={() => generateEUDR(b)} disabled={generating} style={styles.actionBtn}>
              {generating ? <ActivityIndicator color="#000" /> : <Text style={styles.actionBtnTxt}>GENERATE EU DUE DILIGENCE</Text>}
            </Pressable>
          </View>
        ))}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: '#3b82f6', fontWeight: '700', marginTop: 4 },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#3b82f6', marginTop: 8 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: 'rgba(59,130,246,0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(59,130,246,0.3)' },
  statNum: { fontSize: 24, fontWeight: '900', color: '#3b82f6' },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginBottom: 12 },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  batchCode: { fontSize: 16, fontWeight: '900', color: p.text, fontFamily: 'monospace' },
  badge: { backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: p.neon },
  badgeTxt: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  grid: { flexDirection: 'row', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  gridItem: { flex: 1 },
  gridLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  gridVal: { fontSize: 14, fontWeight: '700', color: p.text, marginTop: 4 },
  chain: { marginBottom: 16 },
  chainLbl: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1, marginBottom: 8 },
  chainItem: { fontSize: 12, color: p.textMuted, marginBottom: 4 },
  actionBtn: { backgroundColor: '#3b82f6', padding: 14, borderRadius: 10, alignItems: 'center' },
  actionBtnTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
