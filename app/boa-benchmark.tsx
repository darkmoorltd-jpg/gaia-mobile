import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });

export default function BoaBenchmark() {
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
    const r = await supabase.rpc('boa_peer_benchmark', { p_zone: null });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const boa = data?.boa || {};
  const ind = data?.industry || {};
  const met = data?.boa_metrics || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Peer Benchmark</Text>
        <Text style={styles.sub}>BOA vs Nigerian agri-lending industry</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        <View style={styles.compCard}>
          <Text style={styles.compTitle}>DEFAULT RATE</Text>
          <View style={styles.compRow}>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>BOA + GAIA</Text>
              <Text style={[styles.compVal, { color: '#00ff88' }]}>{met.default_rate}%</Text>
            </View>
            <Text style={styles.compVs}>vs</Text>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>INDUSTRY</Text>
              <Text style={styles.compVal}>{ind.avg_default_rate}%</Text>
            </View>
          </View>
          <Text style={styles.compGap}>
            ▼ {Number((ind.avg_default_rate - met.default_rate)).toFixed(1)} pp better than peers
          </Text>
        </View>

        <View style={styles.compCard}>
          <Text style={styles.compTitle}>RECOVERY RATE</Text>
          <View style={styles.compRow}>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>BOA + GAIA</Text>
              <Text style={[styles.compVal, { color: '#00ff88' }]}>{met.recovery}%</Text>
            </View>
            <Text style={styles.compVs}>vs</Text>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>INDUSTRY</Text>
              <Text style={styles.compVal}>{ind.avg_recovery}%</Text>
            </View>
          </View>
          <Text style={styles.compGap}>▲ {met.recovery - ind.avg_recovery} pp better than peers</Text>
        </View>

        <View style={styles.compCard}>
          <Text style={styles.compTitle}>VERIFICATION COST</Text>
          <View style={styles.compRow}>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>BOA + GAIA</Text>
              <Text style={[styles.compVal, { color: '#00ff88' }]}>N{num(met.verification_cost)}</Text>
            </View>
            <Text style={styles.compVs}>vs</Text>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>INDUSTRY</Text>
              <Text style={styles.compVal}>N{num(ind.avg_verification_cost)}</Text>
            </View>
          </View>
          <Text style={styles.compGap}>
            ▼ {Math.round((1 - met.verification_cost / ind.avg_verification_cost) * 100)}% cheaper than field officer visits
          </Text>
        </View>

        <View style={styles.compCard}>
          <Text style={styles.compTitle}>AVERAGE TICKET</Text>
          <View style={styles.compRow}>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>BOA + GAIA</Text>
              <Text style={styles.compVal}>N{num(boa.avg_ticket)}</Text>
            </View>
            <Text style={styles.compVs}>vs</Text>
            <View style={styles.compSide}>
              <Text style={styles.compAgency}>INDUSTRY</Text>
              <Text style={styles.compVal}>N{num(ind.avg_ticket)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.note}>
          <Text style={styles.noteText}>
            Industry benchmark from public CBN and BOA annual reports (average of top 5 Nigerian agricultural lenders).
          </Text>
        </View>

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
  compCard: { padding: 18, borderRadius: 18, backgroundColor: p.surface, marginBottom: 12, borderWidth: 1, borderColor: p.border },
  compTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 12 },
  compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compSide: { flex: 1, alignItems: 'center' },
  compAgency: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 4 },
  compVal: { fontSize: 26, fontWeight: '900', color: p.text, letterSpacing: -1 },
  compVs: { fontSize: 12, fontWeight: '800', color: p.textMuted, paddingHorizontal: 12 },
  compGap: { fontSize: 11, fontWeight: '800', color: '#00ff88', textAlign: 'center', marginTop: 12 },
  note: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: p.border, marginTop: 8 },
  noteText: { fontSize: 11, color: p.textMuted, lineHeight: 16, fontStyle: 'italic' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
