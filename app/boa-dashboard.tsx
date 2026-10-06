import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const fmtN = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmtM = (n: any) => {
  const x = Number(n || 0);
  if (x >= 1e9) return 'N' + (x / 1e9).toFixed(2) + 'B';
  if (x >= 1e6) return 'N' + (x / 1e6).toFixed(1) + 'M';
  if (x >= 1e3) return 'N' + (x / 1e3).toFixed(0) + 'K';
  return 'N' + x.toFixed(0);
};

export default function Boadashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [portfolio, setPortfolio] = useState<any>(null);
  const [risks, setRisks] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [p, r] = await Promise.all([
      supabase.rpc('boa_portfolio_summary', { p_zone: null }),
      supabase.rpc('boa_risk_radar', { p_zone: null, p_days: 30 }),
    ]);
    if (!p.error) setPortfolio(p.data);
    if (!r.error) setRisks(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  if (!isAdmin) return (
    <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>
  );

  const par = Number(portfolio?.par_amount || 0);
  const parColor = par > 1e9 ? '#ff3b5c' : par > 5e8 ? '#ffb300' : '#00ff88';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.back}>BACK</Text>
          </Pressable>
          <Text style={styles.tag}>BOA x GAIA</Text>
        </View>

        <LinearGradient
          colors={['#0a0e0c', '#101815', '#0a0e0c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>PORTFOLIO AT RISK</Text>
          <Text style={[styles.heroBig, { color: parColor }]}>{fmtM(par)}</Text>
          <View style={styles.heroBar}>
            <View style={[styles.heroBarFill, {
              width: Math.min(100, Number(portfolio?.par_percent || 0)) + '%',
              backgroundColor: parColor,
            }]} />
          </View>
          <Text style={styles.heroSub}>
            {Number(portfolio?.par_percent || 0).toFixed(1)}% of active book
          </Text>
        </LinearGradient>

        {busy && !portfolio ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtM(portfolio?.total_book)}</Text>
            <Text style={styles.kpiLbl}>TOTAL BOOK</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{portfolio?.active_loans ?? 0}</Text>
            <Text style={styles.kpiLbl}>ACTIVE LOANS</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{portfolio?.borrowers ?? 0}</Text>
            <Text style={styles.kpiLbl}>BORROWERS</Text>
          </View>
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>ACTIVE SHOCKS THIS MONTH</Text>
          <Pressable onPress={() => router.push('/boa-risk' as any)}>
            <Text style={styles.linkText}>VIEW ALL</Text>
          </Pressable>
        </View>

        {risks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No active shocks detected.</Text>
          </View>
        ) : (
          risks.slice(0, 4).map((r, i) => {
            const sevColor = r.severity === 1 ? '#ff3b5c' : '#ffb300';
            return (
              <View key={i} style={[styles.shock, { borderLeftColor: sevColor }]}>
                <View style={styles.shockHead}>
                  <Text style={[styles.shockKind, { color: sevColor }]}>
                    {r.kind === 'disease_outbreak' ? 'OUTBREAK' : 'BEHAVIOR'}
                  </Text>
                  <Text style={styles.shockRegion}>{r.region}</Text>
                </View>
                <Text style={styles.shockLabel} numberOfLines={2}>{r.label}</Text>
                <View style={styles.shockRow}>
                  <View>
                    <Text style={styles.shockVal}>{r.affected}</Text>
                    <Text style={styles.shockMeta}>BORROWERS</Text>
                  </View>
                  <View>
                    <Text style={[styles.shockVal, { color: sevColor }]}>{fmtM(r.exposure)}</Text>
                    <Text style={styles.shockMeta}>EXPOSURE</Text>
                  </View>
                </View>
              </View>
            );
          })
        )}

        <View style={styles.tabsRow}>
          <Pressable onPress={() => router.push('/boa-borrowers' as any)} style={styles.tabBtn}>
            <Text style={styles.tabBtnText}>BORROWERS</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/boa-risk' as any)} style={styles.tabBtn}>
            <Text style={styles.tabBtnText}>RISK RADAR</Text>
          </Pressable>
        </View>

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

  hero: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroBig: { fontSize: 42, fontWeight: '900', letterSpacing: -1.5, marginTop: 6 },
  heroBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 14 },
  heroBarFill: { height: '100%', borderRadius: 4 },
  heroSub: { fontSize: 11, fontWeight: '700', color: p.textMuted, marginTop: 8 },

  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 18, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  kpiLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },

  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  linkText: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.neon },

  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  emptyText: { fontSize: 12, color: p.textMuted },

  shock: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border, borderLeftWidth: 4 },
  shockHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  shockKind: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  shockRegion: { fontSize: 10, color: p.textMuted, fontWeight: '700' },
  shockLabel: { fontSize: 14, fontWeight: '800', color: p.text, marginBottom: 12 },
  shockRow: { flexDirection: 'row', gap: 24 },
  shockVal: { fontSize: 18, fontWeight: '900', color: p.text },
  shockMeta: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },

  tabsRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  tabBtn: { flex: 1, padding: 16, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  tabBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.text },

  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
