import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';

const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const money = (n: any) => 'N' + num(n, 0);

export default function AgentHome() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const signOut = useAuth((s) => s.signOut);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const r = await supabase.rpc('agent_dashboard');
    if (!r.error) setData(r.data);
    setBusy(false);
    setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const logout = async () => { await signOut(); router.replace('/(auth)/login'); };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <View style={styles.head}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>GAIA AGENT</Text>
            <Text style={styles.name} numberOfLines={1}>{data?.agent_name || 'Agent'}</Text>
            <Text style={styles.meta}>
              {(data?.agent_zone || 'Zone') + ' · ' + (data?.agent_code || 'GAIA-AG-????')}
            </Text>
          </View>
          <Pressable onPress={logout} style={styles.logout}>
            <Text style={styles.logoutText}>EXIT</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>PENDING COMMISSION</Text>
          <Text style={styles.heroVal}>{money(data?.comm_pending)}</Text>
          <Text style={styles.heroMeta}>
            {num(data?.verified_approved) + ' approved · ' + num(data?.verified_pending) + ' pending review'}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.verified_approved)}</Text>
            <Text style={styles.kpiLbl}>VERIFIED</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.verified_pending)}</Text>
            <Text style={styles.kpiLbl}>PENDING</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{num(data?.registered_total)}</Text>
            <Text style={styles.kpiLbl}>REGISTERED</Text>
          </View>
        </View>

        <View style={styles.ledgerRow}>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerLbl}>THIS WEEK</Text>
            <Text style={styles.ledgerVal}>{money(data?.comm_7d)}</Text>
          </View>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerLbl}>ALL TIME</Text>
            <Text style={styles.ledgerVal}>{money(data?.comm_total)}</Text>
          </View>
          <View style={styles.ledgerItem}>
            <Text style={styles.ledgerLbl}>PAID</Text>
            <Text style={styles.ledgerVal}>{money(data?.comm_paid)}</Text>
          </View>
        </View>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>

        <Pressable onPress={() => router.push('/agent/register' as any)} style={styles.action}>
          <Text style={styles.actionIcon}>+</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Register New Farmer</Text>
            <Text style={styles.actionSub}>Create an account on behalf of a farmer</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/agent/verify' as any)} style={styles.action}>
          <Text style={styles.actionIcon}>V</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Verify a Farmer</Text>
            <Text style={styles.actionSub}>Submit KYC · earns N500 on approval</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/agent/farmers' as any)} style={styles.action}>
          <Text style={styles.actionIcon}>F</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>My Farmers</Text>
            <Text style={styles.actionSub}>Farmers you have registered or verified</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        <Pressable onPress={() => router.push('/agent/ledger' as any)} style={styles.action}>
          <Text style={styles.actionIcon}>N</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.actionTitle}>Commission Ledger</Text>
            <Text style={styles.actionSub}>Every N500 payment and payout</Text>
          </View>
          <Text style={styles.actionChevron}>›</Text>
        </Pressable>

        {busy && !data ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  kicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon },
  name: { fontSize: 24, fontWeight: '900', color: p.text, letterSpacing: -0.5, marginTop: 4 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  logout: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: p.danger },
  logoutText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  hero: { padding: 24, borderRadius: 22, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 16 },
  heroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  heroVal: { fontSize: 42, fontWeight: '900', color: '#00ff88', letterSpacing: -2, marginTop: 4 },
  heroMeta: { fontSize: 11, color: p.textMuted, marginTop: 6 },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiVal: { fontSize: 22, fontWeight: '900', color: p.text, letterSpacing: -0.5 },
  kpiLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  ledgerRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  ledgerItem: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  ledgerLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  ledgerVal: { fontSize: 13, fontWeight: '900', color: p.text, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 10 },
  action: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,255,136,0.12)', color: '#00ff88', fontSize: 18, fontWeight: '900', textAlign: 'center', lineHeight: 36, marginRight: 14 },
  actionTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  actionSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  actionChevron: { fontSize: 22, color: p.textDim, marginLeft: 8 },
});
