import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

const BAND_COLORS: Record<string, string> = {
  A: '#00ff88', B: '#4fc3f7', C: '#ffb300', D: '#ff3b5c',
};

export default function BoaPricing() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [bands, setBands] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('boa_pricing_bands', { p_zone: null });
    if (!r.error) setBands(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const totalBook = bands.reduce((s, b) => s + Number(b.book || 0), 0);
  const totalBorrowers = bands.reduce((s, b) => s + Number(b.borrowers || 0), 0);

  // Interest income uplift estimate vs flat 14%
  const currentIncome = totalBook * 0.14;
  const repricedIncome = bands.reduce((s, b) => s + Number(b.book || 0) * (Number(b.suggested_rate_pct) / 100), 0);
  const uplift = repricedIncome - currentIncome;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Risk-Based Pricing</Text>
        <Text style={styles.sub}>Suggested rate per borrower band</Text>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>ANNUAL INTEREST UPLIFT</Text>
          <Text style={styles.heroVal}>{fmtM(uplift)}</Text>
          <Text style={styles.heroMeta}>vs flat 14% · {totalBorrowers} borrowers · {fmtM(totalBook)} book</Text>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {bands.length === 0 && !busy ? (
          <View style={styles.empty}><Text style={styles.kv}>No active loans to price.</Text></View>
        ) : bands.map((b, i) => {
          const col = BAND_COLORS[b.band] || '#8899a6';
          return (
            <View key={i} style={[styles.bandCard, { borderLeftColor: col }]}>
              <View style={styles.bandHead}>
                <Text style={[styles.bandLabel, { color: col }]}>BAND {b.band}</Text>
                <Text style={styles.bandRate}>{Number(b.suggested_rate_pct).toFixed(1)}% APR</Text>
              </View>
              <View style={styles.bandRow}>
                <View style={styles.bandStat}>
                  <Text style={styles.bandVal}>{b.borrowers}</Text>
                  <Text style={styles.bandLbl}>BORROWERS</Text>
                </View>
                <View style={styles.bandStat}>
                  <Text style={styles.bandVal}>{fmtM(b.book)}</Text>
                  <Text style={styles.bandLbl}>OUTSTANDING</Text>
                </View>
                <View style={styles.bandStat}>
                  <Text style={styles.bandVal}>{fmtM(b.facility_total)}</Text>
                  <Text style={styles.bandLbl}>FACILITY</Text>
                </View>
                <View style={styles.bandStat}>
                  <Text style={[styles.bandVal, { color: col }]}>
                    {fmtM(Number(b.book || 0) * (Number(b.suggested_rate_pct) / 100))}
                  </Text>
                  <Text style={styles.bandLbl}>YEARLY INT.</Text>
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
  hero: { padding: 22, borderRadius: 20, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 20 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 38, fontWeight: '900', color: '#00ff88', letterSpacing: -1.5, marginTop: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  bandCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  bandHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  bandLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  bandRate: { fontSize: 13, fontWeight: '800', color: p.text },
  bandRow: { flexDirection: 'row', gap: 8 },
  bandStat: { flex: 1 },
  bandVal: { fontSize: 13, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
  bandLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
