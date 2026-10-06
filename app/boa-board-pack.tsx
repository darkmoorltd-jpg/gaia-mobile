import { useState } from 'react';
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

export default function BoaBoardPack() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [data, setData] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [p, r, f, fs] = await Promise.all([
      supabase.rpc('boa_portfolio_summary', { p_zone: null }),
      supabase.rpc('boa_risk_radar', { p_zone: null, p_days: 30 }),
      supabase.rpc('boa_collections_forecast', { p_zone: null }),
      supabase.rpc('boa_food_security', { p_zone: null }),
    ]);
    setData({
      portfolio: p.data || {},
      risks: r.data || [],
      forecast: f.data || {},
      food: fs.data || {},
    });
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const p = data.portfolio || {};
  const fc = data.forecast || {};
  const fd = data.food || {};
  const risks = data.risks || [];

  const today = new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
  const peopleFed = Number(fd.total_tonnes || 0) > 0 ? Math.round((Number(fd.total_tonnes) * 1000) / 146) : 0;
  const d30 = fc.horizons?.d30 || {};
  const segments = fc.segments || [];
  const totalLoss = segments.reduce((s: number, x: any) => s + Number(x.expected_loss || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.paper}>
          <Text style={styles.paperKicker}>BANK OF AGRICULTURE</Text>
          <Text style={styles.paperTitle}>Monthly Board Pack</Text>
          <Text style={styles.paperDate}>{today} · Powered by GAIA</Text>

          <View style={styles.divider} />

          <Text style={styles.h}>1. PORTFOLIO</Text>
          <View style={styles.line}><Text style={styles.l}>Total book</Text><Text style={styles.v}>{fmtM(p.total_book)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Outstanding</Text><Text style={styles.v}>{fmtM(p.total_outstanding)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Active loans</Text><Text style={styles.v}>{num(p.active_loans)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Borrowers</Text><Text style={styles.v}>{num(p.borrowers)}</Text></View>
          <View style={styles.line}>
            <Text style={styles.l}>Portfolio at risk</Text>
            <Text style={[styles.v, { color: '#ff3b5c' }]}>{fmtM(p.par_amount)} ({num(p.par_percent, 1)}%)</Text>
          </View>

          <Text style={styles.h}>2. COLLECTIONS</Text>
          <View style={styles.line}><Text style={styles.l}>Due in 30 days</Text><Text style={styles.v}>{fmtM(d30.expected)}</Text></View>
          <View style={styles.line}><Text style={styles.l}>Expected loss</Text><Text style={[styles.v, { color: '#ff3b5c' }]}>{fmtM(totalLoss)}</Text></View>

          <Text style={styles.h}>3. RISK RADAR</Text>
          {risks.length === 0 ? (
            <Text style={styles.l}>No active shocks this month.</Text>
          ) : risks.slice(0, 3).map((r: any, i: number) => (
            <View key={i} style={styles.riskRow}>
              <Text style={[styles.riskDot, { color: r.severity === 1 ? '#ff3b5c' : '#ffb300' }]}>●</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.riskLabel} numberOfLines={1}>{r.label}</Text>
                <Text style={styles.riskMeta}>{r.region} · {r.affected} borrowers · {fmtM(r.exposure)}</Text>
              </View>
            </View>
          ))}

          <Text style={styles.h}>4. FOOD SECURITY IMPACT</Text>
          <View style={styles.line}><Text style={styles.l}>Cultivated area</Text><Text style={styles.v}>{num(fd.total_hectares, 2)} ha</Text></View>
          <View style={styles.line}><Text style={styles.l}>Expected harvest</Text><Text style={styles.v}>{num(fd.total_tonnes, 1)} tonnes</Text></View>
          <View style={styles.line}>
            <Text style={styles.l}>Feeds for one year</Text>
            <Text style={[styles.v, { color: '#00ff88' }]}>{num(peopleFed)} people</Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.signOff}>Prepared by GAIA · Bank of Agriculture</Text>
          <Text style={styles.signOff2}>Screenshot for board presentation</Text>
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
  paper: { padding: 24, borderRadius: 20, backgroundColor: '#0d1410', borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)' },
  paperKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 3, color: '#00ff88', textAlign: 'center' },
  paperTitle: { fontSize: 24, fontWeight: '900', color: '#fff', textAlign: 'center', marginTop: 6, letterSpacing: -0.5 },
  paperDate: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 6 },
  divider: { height: 1, backgroundColor: 'rgba(0,255,136,0.2)', marginVertical: 20 },
  h: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: '#00ff88', marginTop: 16, marginBottom: 8 },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  l: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  v: { fontSize: 13, fontWeight: '800', color: '#fff' },
  riskRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', paddingVertical: 6 },
  riskDot: { fontSize: 12, marginTop: 2 },
  riskLabel: { fontSize: 12, fontWeight: '800', color: '#fff' },
  riskMeta: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  signOff: { fontSize: 10, color: 'rgba(255,255,255,0.4)', textAlign: 'center', letterSpacing: 1 },
  signOff2: { fontSize: 9, color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
