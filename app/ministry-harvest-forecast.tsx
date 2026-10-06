import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const fmtT = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e6) return (x / 1e6).toFixed(2) + 'M t';
  if (x >= 1e3) return (x / 1e3).toFixed(1) + 'K t';
  return x.toFixed(1) + ' t';
};

export default function MinistryHarvestForecast() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>(null);
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('ministry_harvest_forecast', {
      p_crop: cropFilter === 'all' ? null : cropFilter,
    });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin, cropFilter]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalTonnes = Number(data?.total_tonnes || 0);
  const peopleFed = totalTonnes > 0 ? Math.round((totalTonnes * 1000) / 146) : 0;
  const trucks = Math.round(totalTonnes / 30);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Harvest Forecast</Text>
        <Text style={styles.sub}>Pre-harvest yield estimate from real farm data</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>FORECAST HARVEST</Text>
          <Text style={styles.heroVal}>{fmtT(totalTonnes)}</Text>
          <Text style={styles.heroMeta}>{num(data?.total_hectares, 1)} hectares under production</Text>
        </View>

        <View style={styles.impRow}>
          <View style={styles.impCard}>
            <Text style={styles.impVal}>{num(peopleFed)}</Text>
            <Text style={styles.impLbl}>PEOPLE FED (1 YR)</Text>
          </View>
          <View style={styles.impCard}>
            <Text style={styles.impVal}>{num(trucks)}</Text>
            <Text style={styles.impLbl}>30-T TRUCKS</Text>
          </View>
        </View>

        {(data?.crops_available || []).length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Pressable onPress={() => setCropFilter('all')} style={[styles.chip, cropFilter === 'all' && styles.chipOn]}>
              <Text style={[styles.chipText, cropFilter === 'all' && styles.chipTextOn]}>ALL CROPS</Text>
            </Pressable>
            {(data?.crops_available || []).map((c: string) => (
              <Pressable key={c} onPress={() => setCropFilter(c)} style={[styles.chip, cropFilter === c && styles.chipOn]}>
                <Text style={[styles.chipText, cropFilter === c && styles.chipTextOn]}>{String(c).toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>BY CROP</Text>
        {(data?.by_crop || []).length === 0 ? <Text style={styles.kv}>No crops under production.</Text> :
          (data?.by_crop || []).map((c: any, i: number) => (
            <View key={i} style={styles.cropCard}>
              <View style={styles.cropHead}>
                <Text style={styles.cropName}>{c.crop}</Text>
                <Text style={styles.cropTonnes}>{fmtT(c.tonnes)}</Text>
              </View>
              <View style={styles.cropBar}>
                <View style={[styles.cropBarFill, {
                  width: Math.min(100, totalTonnes > 0 ? (Number(c.tonnes) / totalTonnes) * 100 : 0) + '%'
                }]} />
              </View>
              <Text style={styles.cropMeta}>{num(c.hectares, 1)} ha · {c.farmers} farmers</Text>
            </View>
          ))}

        <Text style={styles.sectionLabel}>BY STATE (TOP 15)</Text>
        {(data?.by_state || []).length === 0 ? <Text style={styles.kv}>No state data.</Text> :
          (data?.by_state || []).map((s: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel}>{s.state}</Text>
              <Text style={styles.rowValue}>{fmtT(s.tonnes)}</Text>
            </View>
          ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  hero: { padding: 22, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 12 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 42, fontWeight: '900', color: '#00ff88', letterSpacing: -2, marginTop: 4 },
  heroMeta: { fontSize: 12, color: p.textMuted, marginTop: 6 },
  impRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  impCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  impVal: { fontSize: 20, fontWeight: '900', color: '#ffb300' },
  impLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  chipScroll: { gap: 6, paddingRight: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  cropCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cropHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cropName: { fontSize: 14, fontWeight: '900', color: p.text },
  cropTonnes: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  cropBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 8 },
  cropBarFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },
  cropMeta: { fontSize: 11, color: p.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 13, color: p.text, flex: 1 },
  rowValue: { fontSize: 14, fontWeight: '900', color: p.text },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
