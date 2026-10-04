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

export default function BoaFoodSecurity() {
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
    const r = await supabase.rpc('boa_food_security', { p_zone: null });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalTonnes = Number(data?.total_tonnes || 0);
  // 146 kg dry grain feeds one person for a year (2000 kcal/day)
  const peopleFed = totalTonnes > 0 ? Math.round((totalTonnes * 1000) / 146) : 0;
  const trucks = totalTonnes > 0 ? Math.round(totalTonnes / 30) : 0; // 30-tonne trucks
  const footballPitches = Number(data?.total_hectares || 0) > 0 ? Math.round(Number(data.total_hectares) / 0.714) : 0;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Food Security</Text>
        <Text style={styles.sub}>How much food is BOA's portfolio producing</Text>

        <View style={styles.heroBox}>
          <Text style={styles.heroLabel}>PEOPLE FED FOR ONE YEAR</Text>
          <Text style={styles.heroVal}>{num(peopleFed)}</Text>
          <Text style={styles.heroMeta}>{fmtT(totalTonnes)} of staple crops</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.total_hectares, 2)}</Text>
            <Text style={styles.kpiLbl}>HECTARES</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.farmers)}</Text>
            <Text style={styles.kpiLbl}>FARMERS</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(trucks)}</Text>
            <Text style={styles.kpiLbl}>30-T TRUCKS</Text>
          </View>
        </View>

        <View style={styles.bigNote}>
          <Text style={styles.bigNoteText}>
            Equal to {num(footballPitches)} football pitches of cultivated land, or enough maize,
            rice, and cassava to feed {num(peopleFed)} Nigerians for a year.
          </Text>
        </View>

        <Text style={styles.sectionLabel}>BY CROP</Text>
        {(data?.by_crop || []).length === 0 ? (
          <View style={styles.empty}><Text style={styles.kv}>No active loans with crop data.</Text></View>
        ) : (data.by_crop || []).map((c: any, i: number) => (
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
            <Text style={styles.cropMeta}>
              {num(c.hectares, 2)} hectares · {c.farmers} farmers
            </Text>
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
  heroBox: { padding: 24, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 44, fontWeight: '900', color: '#00ff88', letterSpacing: -2, marginTop: 4 },
  heroMeta: { fontSize: 12, color: p.textMuted, marginTop: 6 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 15, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  bigNote: { padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,179,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', marginBottom: 20 },
  bigNoteText: { fontSize: 12, color: '#ffb300', lineHeight: 19, fontWeight: '600' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  empty: { padding: 20, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  cropCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cropHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cropName: { fontSize: 14, fontWeight: '900', color: p.text },
  cropTonnes: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  cropBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 8 },
  cropBarFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },
  cropMeta: { fontSize: 11, color: p.textMuted },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
