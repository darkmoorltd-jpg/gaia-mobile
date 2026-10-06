import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });

const bandColor = (band: string) =>
  band === 'strong' ? '#00ff88' : band === 'moderate' ? '#ffb300' : '#ff3b5c';

export default function MinistryFoodSecurity() {
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
    const r = await supabase.rpc('ministry_food_security_index', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const score = Number(data?.national_score || 0);
  const col = score >= 70 ? '#00ff88' : score >= 40 ? '#ffb300' : '#ff3b5c';
  const states = data?.by_state || [];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Food Security Index</Text>
        <Text style={styles.sub}>Availability · Access · Utilization</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>NATIONAL FOOD SECURITY</Text>
          <Text style={[styles.heroVal, { color: col }]}>{score.toFixed(1)}</Text>
          <Text style={styles.heroMeta}>out of 100 · {data?.total_states || 0} states scored</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#ff3b5c' }]}>{data?.at_risk_states || 0}</Text>
            <Text style={styles.kpiLbl}>AT RISK STATES</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#00ff88' }]}>{data?.strong_states || 0}</Text>
            <Text style={styles.kpiLbl}>STRONG STATES</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.total_tonnes, 0)}</Text>
            <Text style={styles.kpiLbl}>TONNES</Text>
          </View>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>STATE SCORES (LOWEST FIRST)</Text>
        {states.length === 0 ? <Text style={styles.kv}>No state data.</Text> :
          states.map((s: any, i: number) => {
            const c = bandColor(s.band);
            return (
              <View key={i} style={[styles.card, { borderLeftColor: c }]}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardState}>{s.state}</Text>
                  <Text style={[styles.cardScore, { color: c }]}>{Number(s.food_security_score).toFixed(1)}</Text>
                </View>
                <View style={styles.cardBar}>
                  <View style={[styles.cardBarFill, { width: Math.min(100, Number(s.food_security_score)) + '%', backgroundColor: c }]} />
                </View>
                <View style={styles.cardRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{Number(s.availability_score).toFixed(0)}</Text>
                    <Text style={styles.cardLbl}>AVAIL</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{Number(s.access_score).toFixed(0)}</Text>
                    <Text style={styles.cardLbl}>ACCESS</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{Number(s.utilization_score).toFixed(0)}</Text>
                    <Text style={styles.cardLbl}>UTIL</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{num(s.estimated_tonnes)}</Text>
                    <Text style={styles.cardLbl}>TONNES</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{s.farmers} farmers · {num(s.hectares, 1)} ha</Text>
              </View>
            );
          })}

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
  hero: { padding: 24, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginBottom: 12 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 52, fontWeight: '900', letterSpacing: -3, marginTop: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpi: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 16, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 12, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardState: { fontSize: 14, fontWeight: '900', color: p.text },
  cardScore: { fontSize: 18, fontWeight: '900' },
  cardBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 12 },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  cardMeta: { fontSize: 10, color: p.textMuted },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
