import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 1) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });

export default function MinistryYieldGap() {
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
    const r = await supabase.rpc('ministry_yield_gap', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const avgGap = Number(data?.avg_gap_pct || 0);
  const gapColor = avgGap > 50 ? '#ff3b5c' : avgGap > 30 ? '#ffb300' : '#00ff88';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Yield Gap Analysis</Text>
        <Text style={styles.sub}>Actual vs achievable yield · where to invest</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>NATIONWIDE YIELD GAP</Text>
          <Text style={[styles.heroVal, { color: gapColor }]}>{avgGap.toFixed(1)}%</Text>
          <Text style={styles.heroMeta}>{data?.total_lgas || 0} LGAs analyzed</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>GAP BY CROP</Text>
        {(data?.by_crop || []).length === 0 ? <Text style={styles.kv}>No yield data.</Text> :
          (data?.by_crop || []).map((c: any, i: number) => {
            const gap = Number(c.avg_gap_pct || 0);
            const col = gap > 50 ? '#ff3b5c' : gap > 30 ? '#ffb300' : '#00ff88';
            return (
              <View key={i} style={styles.cropCard}>
                <View style={styles.cropHead}>
                  <Text style={styles.cropName}>{c.crop}</Text>
                  <Text style={[styles.cropGap, { color: col }]}>{gap.toFixed(1)}%</Text>
                </View>
                <View style={styles.cropBar}>
                  <View style={[styles.cropBarFill, { width: Math.min(100, gap) + '%', backgroundColor: col }]} />
                </View>
                <View style={styles.cropRow}>
                  <View style={styles.cropStat}>
                    <Text style={styles.cropVal}>{num(c.avg_actual, 2)} t/ha</Text>
                    <Text style={styles.cropLbl}>ACTUAL</Text>
                  </View>
                  <View style={styles.cropStat}>
                    <Text style={styles.cropVal}>{num(c.avg_achievable, 2)} t/ha</Text>
                    <Text style={styles.cropLbl}>ACHIEVABLE</Text>
                  </View>
                  <View style={styles.cropStat}>
                    <Text style={styles.cropVal}>{c.farmers}</Text>
                    <Text style={styles.cropLbl}>FARMERS</Text>
                  </View>
                  <View style={styles.cropStat}>
                    <Text style={styles.cropVal}>{c.lgas}</Text>
                    <Text style={styles.cropLbl}>LGAS</Text>
                  </View>
                </View>
              </View>
            );
          })}

        <Text style={styles.sectionLabel}>TOP 20 LGAS TO PRIORITIZE</Text>
        {(data?.worst_lgas || []).length === 0 ? <Text style={styles.kv}>No LGA data.</Text> :
          (data?.worst_lgas || []).map((l: any, i: number) => (
            <View key={i} style={styles.lgaRow}>
              <View style={styles.lgaRank}>
                <Text style={styles.lgaRankText}>{i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lgaName} numberOfLines={1}>{l.state}{l.lga ? ' · ' + l.lga : ''}</Text>
                <Text style={styles.lgaMeta}>{l.crop} · {l.farmers} farmers · trust {num(l.avg_trust, 0)}</Text>
                <Text style={styles.lgaMeta}>{num(l.actual, 2)} t/ha actual · {num(l.achievable, 2)} t/ha achievable</Text>
              </View>
              <Text style={[styles.lgaGap, { color: Number(l.gap_pct) > 50 ? '#ff3b5c' : '#ffb300' }]}>
                {num(l.gap_pct, 1)}%
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
  hero: { padding: 22, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 44, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 12, color: p.textMuted },
  cropCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cropHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cropName: { fontSize: 14, fontWeight: '900', color: p.text },
  cropGap: { fontSize: 16, fontWeight: '900' },
  cropBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 12 },
  cropBarFill: { height: '100%', borderRadius: 3 },
  cropRow: { flexDirection: 'row', gap: 8 },
  cropStat: { flex: 1 },
  cropVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cropLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  lgaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  lgaRank: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,59,92,0.15)', alignItems: 'center', justifyContent: 'center' },
  lgaRankText: { fontSize: 12, fontWeight: '900', color: '#ff3b5c' },
  lgaName: { fontSize: 13, fontWeight: '800', color: p.text },
  lgaMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  lgaGap: { fontSize: 16, fontWeight: '900' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
