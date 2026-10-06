import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

export default function MinistryProgramDelivery() {
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
    const r = await supabase.rpc('ministry_program_delivery', {});
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const states = data?.by_state || [];
  const totalFarmers = Number(data?.total_farmers || 0);
  const totalVerified = Number(data?.total_verified || 0);
  const verifiedPct = totalFarmers > 0 ? ((totalVerified / totalFarmers) * 100).toFixed(1) : '0.0';
  const integrityColor = Number(verifiedPct) > 80 ? '#00ff88' : Number(verifiedPct) > 50 ? '#ffb300' : '#ff3b5c';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Program Delivery</Text>
        <Text style={styles.sub}>Verified delivery across all programs</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>PROGRAM INTEGRITY</Text>
          <Text style={[styles.heroVal, { color: integrityColor }]}>{verifiedPct}%</Text>
          <View style={styles.heroBar}>
            <View style={[styles.heroBarFill, { width: Math.min(100, Number(verifiedPct)) + '%', backgroundColor: integrityColor }]} />
          </View>
          <Text style={styles.heroMeta}>{totalVerified} of {totalFarmers} farmers verified active</Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtN(data?.total_allocated)}</Text>
            <Text style={styles.kpiLbl}>ALLOCATED</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={[styles.kpiVal, { color: '#ff3b5c' }]}>{data?.total_at_risk || 0}</Text>
            <Text style={styles.kpiLbl}>AT RISK</Text>
          </View>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <Text style={styles.sectionLabel}>BY STATE</Text>
        {states.length === 0 ? <Text style={styles.kv}>No program data.</Text> :
          states.map((s: any, i: number) => {
            const pct = Number(s.verification_pct || 0);
            const col = pct > 80 ? '#00ff88' : pct > 50 ? '#ffb300' : '#ff3b5c';
            return (
              <View key={i} style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardState}>{s.state}</Text>
                  <Text style={[styles.cardPct, { color: col }]}>{pct.toFixed(1)}%</Text>
                </View>
                <View style={styles.cardBar}>
                  <View style={[styles.cardBarFill, { width: Math.min(100, pct) + '%', backgroundColor: col }]} />
                </View>
                <View style={styles.cardRow}>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{fmtN(s.allocated)}</Text>
                    <Text style={styles.cardLbl}>ALLOCATED</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{s.farmers}</Text>
                    <Text style={styles.cardLbl}>FARMERS</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={styles.cardVal}>{s.verified_users}</Text>
                    <Text style={styles.cardLbl}>VERIFIED</Text>
                  </View>
                  <View style={styles.cardStat}>
                    <Text style={[styles.cardVal, { color: '#ff3b5c' }]}>{s.at_risk}</Text>
                    <Text style={styles.cardLbl}>AT RISK</Text>
                  </View>
                </View>
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
  hero: { padding: 22, borderRadius: 22, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 42, fontWeight: '900', letterSpacing: -2, marginTop: 4 },
  heroBar: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 14 },
  heroBarFill: { height: '100%', borderRadius: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 18, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 3 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardState: { fontSize: 14, fontWeight: '900', color: p.text },
  cardPct: { fontSize: 15, fontWeight: '900' },
  cardBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginBottom: 12 },
  cardBarFill: { height: '100%', borderRadius: 3 },
  cardRow: { flexDirection: 'row', gap: 8 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
