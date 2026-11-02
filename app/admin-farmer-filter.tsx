import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Share } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const STATES = ['Kaduna', 'Kano', 'Lagos', 'Oyo', 'Enugu', 'Benue', 'FCT Abuja', 'Plateau'];

export default function AdminFarmerFilter() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [state, setState] = useState<string>('');
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  const load = async (selectedState: string) => {
    setState(selectedState);
    setBusy(true);
    const { data } = await supabase.rpc('admin_filter_farmers', { p_state: selectedState || null });
    setRows(data || []);
    setBusy(false);
  };

  useEffect(() => { load(''); }, []);

  const exportCsv = async () => {
    if (rows.length === 0) { alert('No data to export'); return; }
    const header = "Name,Phone,State,LGA,Crop,FarmSize,Status,Registered\n";
    const body = rows.map(r => `${r.name},${r.phone},${r.state},${r.lga},${r.crop},${r.farm_size_acres},${r.verification_status},${r.created_at.split('T')[0]}`).join('\n');
    const csv = header + body;
    const path = FileSystem.cacheDirectory + 'GAIA_Farmers_' + Date.now() + '.csv';
    await FileSystem.writeAsStringAsync(path, csv);
    
    try {
      await Share.share({ title: 'GAIA Farmer Export', message: csv, url: path });
    } catch (e) { console.warn(e); }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Regional Farmers</Text>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <Pressable onPress={() => load('')} style={[styles.chip, state === '' && styles.chipOn]}>
            <Text style={[styles.chipTxt, state === '' && { color: '#000' }]}>ALL STATES</Text>
          </Pressable>
          {STATES.map(s => (
            <Pressable key={s} onPress={() => load(s)} style={[styles.chip, state === s && styles.chipOn]}>
              <Text style={[styles.chipTxt, state === s && { color: '#000' }]}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>{rows.length} FARMERS FOUND</Text>
          <Pressable onPress={exportCsv} style={styles.exportBtn}>
            <Text style={styles.exportTxt}>📤 EXPORT CSV</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {rows.map((r, i) => (
          <View key={i} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.boldText}>{r.name || 'Unknown'}</Text>
              <Text style={styles.text}>{r.phone} · {r.state} · {r.crop}</Text>
            </View>
            <Text style={[styles.status, { color: r.verification_status === 'approved' ? '#00ff88' : '#ffb300' }]}>
              {(r.verification_status || 'pending').toUpperCase()}
            </Text>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginRight: 8 },
  chipOn: { backgroundColor: p.neon, borderColor: p.neon },
  chipTxt: { fontSize: 11, fontWeight: '800', color: p.textMuted },
  sectionLabel: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  exportBtn: { backgroundColor: 'rgba(0,255,136,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.neon },
  exportTxt: { fontSize: 10, fontWeight: '900', color: p.neon },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  boldText: { fontSize: 14, fontWeight: '800', color: p.text },
  text: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  status: { fontSize: 9, fontWeight: '900' },
});
