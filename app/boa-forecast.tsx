import React, { useCallback, useEffect, useState } from 'react';
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

const BUCKET_COLORS: Record<string, string> = {
  healthy: '#00ff88',
  watch: '#ffb300',
  at_risk: '#ff6b35',
  critical: '#ff3b5c',
};

export default function BoaForecast() {
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
    const r = await supabase.rpc('boa_collections_forecast', { p_zone: null });
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const horizons = data?.horizons || {};
  const segments = data?.segments || [];
  const totalLoss = segments.reduce((s: number, x: any) => s + Number(x.expected_loss || 0), 0);
  const totalBook = segments.reduce((s: number, x: any) => s + Number(x.book || 0), 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Collections Forecast</Text>
        <Text style={styles.sub}>Expected vs risk-adjusted recovery</Text>

        {busy && !data ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        <View style={styles.horizonRow}>
          {[
            { k: 'd30', label: '30 DAYS' },
            { k: 'd60', label: '60 DAYS' },
            { k: 'd90', label: '90 DAYS' },
          ].map((h) => {
            const hd = horizons[h.k] || {};
            return (
              <View key={h.k} style={styles.horizonCard}>
                <Text style={styles.horizonLabel}>{h.label}</Text>
                <Text style={styles.horizonVal}>{fmtM(hd.expected)}</Text>
                <Text style={styles.horizonMeta}>{hd.count ?? 0} payments due</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.bigBox}>
          <Text style={styles.bigLabel}>TOTAL EXPECTED LOSS</Text>
          <Text style={[styles.bigVal, { color: '#ff3b5c' }]}>{fmtM(totalLoss)}</Text>
          <Text style={styles.bigMeta}>
            {totalBook > 0 ? ((totalLoss / totalBook) * 100).toFixed(2) : '0.00'}% of active book
          </Text>
        </View>

        <Text style={styles.sectionLabel}>BEHAVIOR SEGMENTS</Text>
        {segments.length === 0 ? (
          <View style={styles.empty}><Text style={styles.kv}>No active loans in book.</Text></View>
        ) : segments.map((s: any, i: number) => {
          const col = BUCKET_COLORS[s.bucket] || '#8899a6';
          return (
            <View key={i} style={[styles.segCard, { borderLeftColor: col }]}>
              <View style={styles.segHead}>
                <Text style={[styles.segBucket, { color: col }]}>{String(s.bucket).toUpperCase().replace('_', ' ')}</Text>
                <Text style={styles.segCount}>{s.borrowers} borrowers</Text>
              </View>
              <View style={styles.segRow}>
                <View style={styles.segStat}>
                  <Text style={styles.segVal}>{fmtM(s.book)}</Text>
                  <Text style={styles.segLbl}>BOOK</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={[styles.segVal, { color: palette.neon }]}>{fmtM(s.expected_collection)}</Text>
                  <Text style={styles.segLbl}>EXPECTED</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={[styles.segVal, { color: '#ff3b5c' }]}>{fmtM(s.expected_loss)}</Text>
                  <Text style={styles.segLbl}>LOSS</Text>
                </View>
                <View style={styles.segStat}>
                  <Text style={styles.segVal}>{s.recovery_pct}%</Text>
                  <Text style={styles.segLbl}>RECOVERY</Text>
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  horizonRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  horizonCard: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  horizonLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  horizonVal: { fontSize: 18, fontWeight: '900', color: p.text, marginTop: 4, letterSpacing: -0.5 },
  horizonMeta: { fontSize: 9, color: p.textMuted, marginTop: 4 },
  bigBox: { padding: 22, borderRadius: 20, backgroundColor: 'rgba(255,59,92,0.06)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)', alignItems: 'center', marginBottom: 24 },
  bigLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  bigVal: { fontSize: 40, fontWeight: '900', letterSpacing: -1.5, marginTop: 4 },
  bigMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  segCard: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  segHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  segBucket: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
  segCount: { fontSize: 11, color: p.textMuted, fontWeight: '700' },
  segRow: { flexDirection: 'row', gap: 8 },
  segStat: { flex: 1 },
  segVal: { fontSize: 13, fontWeight: '900', color: p.text, letterSpacing: -0.3 },
  segLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  kv: { fontSize: 12, color: p.textMuted },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
