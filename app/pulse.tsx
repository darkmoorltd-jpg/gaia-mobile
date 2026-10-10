import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const CROPS = ['Maize','Rice','Sorghum','Millet','Cowpea (Beans)','Soybean','Groundnut','Tomato','Pepper','Onion','Cassava','Yam'];

const KIND_EMOJI: Record<string, string> = {
  planted:'🌱', sprayed:'🧪', weeded:'🌿', fertilized:'💩', watered:'💧',
  rained:'🌧', disease:'🦠', pest:'🐛', note:'📝', harvest:'🌾',
};

function ago(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  return Math.floor(s / 86400) + 'd';
}

export default function Pulse() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [state, setState] = useState<string | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async (c: string | null) => {
    if (!state) return;
    setBusy(true);
    const { data: d } = await supabase.rpc('pulse_get', {
      p_state: state, p_crop: c, p_hours: 48,
    });
    setData(d);
    setBusy(false);
    setRef(false);
  }, [state]);

  useEffect(() => {
    (async () => {
      const { data: p } = await supabase.from('user_profiles')
        .select('state').eq('user_id', user?.id).maybeSingle();
      setState(p?.state || 'Kaduna');
    })();
  }, [user?.id]);

  useEffect(() => { if (state) load(crop); }, [state, crop, load]);

  if (!state) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  const sprayed = data?.sprayed || 0;
  const disease = data?.disease_seen || 0;
  const harvested = data?.harvested || 0;
  const planted = data?.planted || 0;
  const recent = data?.recent || [];
  const diseases = data?.top_diseases || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(crop); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <LinearGradient colors={['#1a0f2e', '#2d1b4e', '#1a0f2e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={styles.liveTxt}>LIVE</Text>
          </View>
          <Text style={styles.heroTitle}>{state} right now</Text>
          <Text style={styles.heroSub}>Last 48 hours across your state</Text>
        </LinearGradient>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{planted}</Text><Text style={styles.kpiLbl}>PLANTED</Text></View>
          <View style={styles.kpi}><Text style={styles.kpiVal}>{sprayed}</Text><Text style={styles.kpiLbl}>SPRAYED</Text></View>
          <View style={[styles.kpi, styles.kpiWarn]}><Text style={[styles.kpiVal, { color: '#ffb300' }]}>{disease}</Text><Text style={styles.kpiLbl}>DISEASE SEEN</Text></View>
          <View style={[styles.kpi, styles.kpiGood]}><Text style={[styles.kpiVal, { color: '#00ff88' }]}>{harvested}</Text><Text style={styles.kpiLbl}>HARVESTED</Text></View>
        </View>

        <Text style={styles.sectionLabel}>FILTER BY CROP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setCrop(null)} style={[styles.chip, crop === null && styles.chipOn]}>
            <Text style={[styles.chipTxt, crop === null && styles.chipTxtOn]}>All</Text>
          </Pressable>
          {CROPS.map((c) => (
            <Pressable key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipOn]}>
              <Text style={[styles.chipTxt, crop === c && styles.chipTxtOn]}>{c}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {diseases.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>TOP DISEASES IN {state.toUpperCase()}</Text>
            {diseases.map((d: any, i: number) => (
              <View key={i} style={styles.disRow}>
                <Text style={styles.disName}>{d.disease}</Text>
                <Text style={styles.disN}>{d.n}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.sectionLabel}>LIVE FEED</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : recent.length === 0 ? (
          <Text style={styles.kv}>No activity in the last 48 hours.</Text>
        ) : recent.map((e: any, i: number) => (
          <View key={i} style={styles.feedRow}>
            <Text style={styles.feedEmoji}>{KIND_EMOJI[e.kind] || '•'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.feedLabel} numberOfLines={1}>{e.label || e.kind}</Text>
              <Text style={styles.feedMeta}>A farmer in {state} · {ago(e.at)} ago</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  hero: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(179,136,255,0.3)', marginBottom: 16 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#b388ff' },
  liveTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#b388ff' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 8 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  kpiRow: { flexDirection: 'row', gap: 6, marginBottom: 20 },
  kpi: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiWarn: { borderColor: 'rgba(255,179,0,0.3)' },
  kpiGood: { borderColor: 'rgba(0,255,136,0.3)' },
  kpiVal: { fontSize: 20, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3, textAlign: 'center' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 12, marginBottom: 10 },
  chipRow: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipTxt: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  chipTxtOn: { color: '#b388ff' },
  disRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  disName: { fontSize: 13, fontWeight: '700', color: p.text, flex: 1 },
  disN: { fontSize: 14, fontWeight: '900', color: '#ffb300' },
  kv: { fontSize: 12, color: p.textMuted },
  feedRow: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  feedEmoji: { fontSize: 20 },
  feedLabel: { fontSize: 13, fontWeight: '700', color: p.text },
  feedMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
});
