import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function MinistryDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('ministry_national_summary', { p_days: 7 });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const ds = data?.disease_signal || {};
  const hf = data?.harvest_forecast || {};
  const pi = data?.program_integrity || {};
  const delta = (ds.this_week || 0) - (ds.prior_week || 0);
  const pctChange = ds.prior_week ? (delta / ds.prior_week * 100) : 0;
  const tone = delta > 0 ? '#ff3b5c' : delta < 0 ? '#00ff88' : '#8899a6';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>

        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.tag}>FED MIN AGRI x GAIA</Text>
        </View>

        <Text style={styles.title}>National Briefing</Text>
        <Text style={styles.sub}>Updated {data?.generated_at ? new Date(data.generated_at).toLocaleString() : '—'}</Text>

        <LinearGradient
          colors={['#0a1a0d', '#0d2a15', '#0a1a0d']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>NATIONWIDE DISEASE SIGNAL</Text>
          <Text style={[styles.heroBig, { color: tone }]}>{num(ds.this_week || 0)}</Text>
          <Text style={styles.heroMeta}>
            {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {Math.abs(pctChange).toFixed(1)}% vs last week
          </Text>
        </LinearGradient>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(hf.total_hectares)}</Text>
            <Text style={styles.kpiLbl}>HECTARES</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(pi.total_loans)}</Text>
            <Text style={styles.kpiLbl}>ACTIVE PROGRAMS</Text>
          </View>
          <View style={[styles.kpi, pi.delinquent > 0 && { borderColor: '#ff3b5c' }]}>
            <Text style={[styles.kpiVal, pi.delinquent > 0 && { color: '#ff3b5c' }]}>{num(pi.delinquent)}</Text>
            <Text style={styles.kpiLbl}>AT RISK</Text>
          </View>
        </View>

        {busy && !data ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        <Text style={styles.sectionLabel}>TOP DISEASES THIS WEEK</Text>
        {(ds.top_diseases || []).length === 0 ? <Text style={styles.kv}>No disease hits detected.</Text> :
          (ds.top_diseases || []).map((d: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>{d.disease}</Text>
              <Text style={[styles.rowValue, { color: '#ff3b5c' }]}>{d.n}</Text>
            </View>
          ))}

        <Text style={styles.sectionLabel}>HOTSPOT STATES</Text>
        {(ds.hotspot_states || []).length === 0 ? <Text style={styles.kv}>No hotspot data.</Text> :
          (ds.hotspot_states || []).map((s: any, i: number) => (
            <View key={i} style={styles.row}>
              <Text style={styles.rowLabel} numberOfLines={1}>{s.state}</Text>
              <Text style={styles.rowValue}>{s.n}</Text>
            </View>
          ))}

        <Text style={styles.sectionLabel}>PRODUCTION BY CROP</Text>
        {(hf.by_crop || []).length === 0 ? <Text style={styles.kv}>No production data.</Text> :
          (hf.by_crop || []).map((c: any, i: number) => (
            <View key={i} style={styles.cropCard}>
              <View style={styles.cropHead}>
                <Text style={styles.cropName}>{c.crop}</Text>
                <Text style={styles.cropTonnes}>{num(c.tonnes)} t</Text>
              </View>
              <Text style={styles.cropMeta}>{num(c.hectares)} hectares</Text>
            </View>
          ))}

        <Pressable onPress={() => router.push('/ministry-disease-map' as any)} style={styles.actionBtn}>
          <Text style={styles.actionBtnText}>OPEN FULL DISEASE MAP</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  tag: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 11, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  hero: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', marginBottom: 16 },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroBig: { fontSize: 44, fontWeight: '900', letterSpacing: -2, marginTop: 6 },
  heroMeta: { fontSize: 12, color: p.textMuted, marginTop: 6, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 16, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowLabel: { fontSize: 13, color: p.text, flex: 1, marginRight: 12 },
  rowValue: { fontSize: 14, fontWeight: '900', color: p.text },
  kv: { fontSize: 12, color: p.textMuted },
  cropCard: { padding: 12, borderRadius: 12, backgroundColor: p.surface, marginBottom: 6, borderWidth: 1, borderColor: p.border },
  cropHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cropName: { fontSize: 13, fontWeight: '800', color: p.text },
  cropTonnes: { fontSize: 13, fontWeight: '900', color: '#00ff88' },
  cropMeta: { fontSize: 11, color: p.textMuted },
  actionBtn: { marginTop: 24, padding: 18, borderRadius: 14, borderWidth: 1.5, borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.06)', alignItems: 'center' },
  actionBtnText: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
