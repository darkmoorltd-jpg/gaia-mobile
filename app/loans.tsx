import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function Loans() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [elig, setElig] = useState<any>(null);
  const [active, setActive] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const [e, a, h] = await Promise.all([
        supabase.rpc('loan_eligibility'),
        supabase.rpc('loan_my_active'),
        supabase.rpc('loan_my_history'),
      ]);
      if (!e.error) setElig(e.data);
      if (!a.error) setActive(Object.keys(a.data || {}).length ? a.data : null);
      if (!h.error) setHistory(h.data || []);
    } catch {}
    setBusy(false); setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const tierColor = (t: string) => {
    switch ((t || '').toLowerCase()) {
      case 'platinum': return '#e5e4e2';
      case 'gold': return '#ffd700';
      case 'silver': return '#c0c0c0';
      case 'bronze': return '#cd7f32';
      case 'starter': return '#4fc3f7';
      default: return '#8899a6';
    }
  };

  const score = elig?.trust_score ?? 0;
  const scorePct = Math.min(100, (score / 1000) * 100);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>FARM FINANCE</Text>
        <Text style={styles.title}>Loans</Text>

        {busy && !elig ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {elig ? (
          <>
            <LinearGradient colors={['#00cc6a', '#009e52', '#00582e']} style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>TRUST SCORE</Text>
              <View style={styles.scoreRing}>
                <Text style={styles.scoreNum}>{score}</Text>
                <Text style={styles.scoreMax}>/ 1000</Text>
              </View>
              <View style={styles.scoreBar}>
                <View style={[styles.scoreBarFill, { width: scorePct + '%' }]} />
              </View>
              <View style={[styles.tierChip, { borderColor: tierColor(elig.tier) }]}>
                <Text style={[styles.tierText, { color: tierColor(elig.tier) }]}>
                  {(elig.tier || 'none').toUpperCase()} TIER
                </Text>
              </View>
            </LinearGradient>

            {elig.max_amount > 0 ? (
              <View style={styles.eligCard}>
                <Text style={styles.eligLabel}>YOU QUALIFY FOR UP TO</Text>
                <Text style={styles.eligAmount}>{money(elig.max_amount)}</Text>
                <View style={styles.eligRow}>
                  <View style={styles.eligCol}>
                    <Text style={styles.eligVal}>{elig.interest_rate}%</Text>
                    <Text style={styles.eligKey}>PER MONTH</Text>
                  </View>
                  <View style={styles.eligDiv} />
                  <View style={styles.eligCol}>
                    <Text style={styles.eligVal}>{elig.term_months} mo</Text>
                    <Text style={styles.eligKey}>MAX TERM</Text>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.lockedCard}>
                <Text style={styles.lockedTitle}>LOCKED</Text>
                <Text style={styles.lockedBody}>
                  Complete your profile (KYC, farm details, phone) to unlock loans. Minimum score: 150.
                </Text>
                <Pressable onPress={() => router.push('/(tabs)/profile' as any)} style={styles.lockedBtn}>
                  <Text style={styles.lockedBtnText}>COMPLETE PROFILE</Text>
                </Pressable>
              </View>
            )}

            {active ? (
              <Pressable onPress={() => router.push(('/loan-detail?id=' + active.id) as any)} style={styles.activeCard}>
                <Text style={styles.activeLabel}>ACTIVE LOAN</Text>
                <Text style={styles.activeAmount}>{money(active.loan_amount)}</Text>
                <View style={styles.activeRow}>
                  <Text style={styles.activeMeta}>Outstanding {money(active.outstanding_balance)}</Text>
                  <Text style={[styles.activeStatus, { color: active.status === 'overdue' ? '#ff3b5c' : '#ffb300' }]}>
                    {(active.status || '').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.activeBar}>
                  <View style={[styles.activeBarFill, {
                    width: Math.max(0, Math.min(100, ((active.loan_amount - active.outstanding_balance) / active.loan_amount) * 100)) + '%',
                  }]} />
                </View>
                <Text style={styles.activeDue}>Due {new Date(active.due_date).toLocaleDateString()}</Text>
              </Pressable>
            ) : elig.max_amount > 0 ? (
              <Pressable onPress={() => router.push('/loans-apply' as any)} style={styles.applyBtn}>
                <Text style={styles.applyText}>APPLY FOR LOAN</Text>
              </Pressable>
            ) : null}

            <Text style={styles.sectionLabel}>HISTORY</Text>
            {history.length === 0 ? (
              <Text style={styles.empty}>No loans yet.</Text>
            ) : history.map((h, i) => (
              <Pressable key={i} onPress={() => router.push(('/loan-detail?id=' + h.id) as any)} style={styles.historyRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyAmount}>{money(h.loan_amount)}</Text>
                  <Text style={styles.historyMeta}>{(h.status || '').toUpperCase()} · {new Date(h.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ))}
          </>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4, marginBottom: 16 },
  scoreCard: { borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 16 },
  scoreLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  scoreRing: { flexDirection: 'row', alignItems: 'baseline', marginTop: 8 },
  scoreNum: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2 },
  scoreMax: { fontSize: 16, color: 'rgba(255,255,255,0.7)', fontWeight: '700', marginLeft: 6 },
  scoreBar: { width: '100%', height: 6, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 3, marginTop: 14 },
  scoreBarFill: { height: '100%', backgroundColor: '#fff', borderRadius: 3 },
  tierChip: { marginTop: 12, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 2, backgroundColor: 'rgba(0,0,0,0.35)' },
  tierText: { fontSize: 11, fontWeight: '900', letterSpacing: 2 },
  eligCard: { padding: 18, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  eligLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.textMuted },
  eligAmount: { fontSize: 32, fontWeight: '900', color: p.neon, marginTop: 6, letterSpacing: -1 },
  eligRow: { flexDirection: 'row', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  eligCol: { flex: 1, alignItems: 'center' },
  eligDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  eligVal: { fontSize: 16, fontWeight: '900', color: p.text },
  eligKey: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 4 },
  lockedCard: { padding: 18, borderRadius: 18, backgroundColor: 'rgba(255,59,92,0.06)', borderWidth: 1, borderColor: '#ff3b5c', marginBottom: 12 },
  lockedTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#ff3b5c' },
  lockedBody: { fontSize: 12, color: p.text, marginTop: 8, lineHeight: 18 },
  lockedBtn: { marginTop: 14, padding: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  lockedBtnText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  activeCard: { padding: 18, borderRadius: 18, backgroundColor: p.surface, borderWidth: 1.5, borderColor: '#ffb300', marginBottom: 12 },
  activeLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#ffb300' },
  activeAmount: { fontSize: 28, fontWeight: '900', color: p.text, marginTop: 4, letterSpacing: -1 },
  activeRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  activeMeta: { fontSize: 12, color: p.textMuted },
  activeStatus: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  activeBar: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, marginTop: 10 },
  activeBarFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },
  activeDue: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  applyBtn: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginBottom: 12 },
  applyText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 22, marginBottom: 10 },
  empty: { fontSize: 12, color: p.textMuted },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  historyAmount: { fontSize: 14, fontWeight: '800', color: p.text },
  historyMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  chevron: { fontSize: 20, color: p.textDim },
});
