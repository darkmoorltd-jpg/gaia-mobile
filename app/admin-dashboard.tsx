import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const NGN = (n: any) => '₦' + Number(n || 0).toLocaleString();

export default function AdminDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [kpi, setKpi] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_kpi_dashboard');
      if (!error) setKpi(data);
    } catch {}
    setBusy(false); setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isAdmin) return; const t = setInterval(load, 30000); return () => clearInterval(t); }, [isAdmin, load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.sub}>Live KPIs · refresh 30s</Text>

        {busy && !kpi ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {kpi ? (
          <>
            <Text style={styles.sectionLabel}>USERS</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="TOTAL" value={kpi.users_total} />
              <Box styles={styles} label="ONLINE NOW" value={kpi.users_online_now} highlight />
              <Box styles={styles} label="+7D" value={kpi.users_new_7d} />
              <Box styles={styles} label="+30D" value={kpi.users_new_30d} />
              <Box styles={styles} label="BANNED" value={kpi.users_banned} />
            </View>

            <Text style={styles.sectionLabel}>REVENUE</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="LIFETIME" value={NGN(kpi.revenue_lifetime)} highlight />
              <Box styles={styles} label="30D" value={NGN(kpi.revenue_30d)} />
              <Box styles={styles} label="7D" value={NGN(kpi.revenue_7d)} />
              <Box styles={styles} label="PAYMENTS 30D" value={kpi.payments_30d} />
            </View>

            <Text style={styles.sectionLabel}>KYC</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="PENDING" value={kpi.kyc_pending} highlight />
              <Box styles={styles} label="APPROVED" value={kpi.kyc_approved} />
              <Box styles={styles} label="REJECTED" value={kpi.kyc_rejected} />
            </View>

            <Text style={styles.sectionLabel}>MARKETPLACE</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="LISTINGS" value={kpi.listings_active} />
              <Box styles={styles} label="ORDERS" value={kpi.orders_total} />
              <Box styles={styles} label="PENDING" value={kpi.orders_pending} />
              <Box styles={styles} label="DISPUTES" value={kpi.disputes_open} highlight />
            </View>

            <Text style={styles.sectionLabel}>OPERATIONS</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="TICKETS OPEN" value={kpi.tickets_open} />
              <Box styles={styles} label="WITHDRAWALS" value={kpi.withdrawals_pending} />
              <Box styles={styles} label="WD ₦ PENDING" value={NGN(kpi.withdrawals_pending_amount)} />
              <Box styles={styles} label="BADGES ACTIVE" value={kpi.badges_active} />
            </View>

            <Text style={styles.sectionLabel}>AI USAGE</Text>
            <View style={styles.grid}>
              <Box styles={styles} label="SCANS LEFT (ALL)" value={kpi.scans_remaining_total} />
              <Box styles={styles} label="SESSIONS" value={kpi.agronomist_sessions_total} />
              <Box styles={styles} label="MESSAGES" value={kpi.agronomist_messages_total} />
            </View>

            <Text style={styles.sectionLabel}>TOP STATES</Text>
            {(kpi.top_states || []).length === 0 ? <Text style={styles.kv}>No location data.</Text> :
              (kpi.top_states || []).map((s: any, i: number) => (
                <View key={i} style={styles.row2}>
                  <Text style={styles.rowLabel}>{s.state}</Text>
                  <View style={[styles.bar, { flex: s.n }]} />
                  <Text style={styles.rowValue}>{s.n}</Text>
                </View>
              ))}

            <Text style={styles.sectionLabel}>SIGNUPS (30D)</Text>
            {(kpi.signups_daily || []).length === 0 ? <Text style={styles.kv}>No signups.</Text> :
              (kpi.signups_daily || []).map((d: any, i: number) => (
                <View key={i} style={styles.row2}>
                  <Text style={styles.rowLabel}>{String(d.day).slice(0, 10)}</Text>
                  <View style={[styles.bar, { flex: d.n }]} />
                  <Text style={styles.rowValue}>{d.n}</Text>
                </View>
              ))}

            <View style={{ height: 60 }} />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Box({ styles, label, value, highlight }: any) {
  return (
    <View style={[styles.box, highlight && styles.boxHi]}>
      <Text style={styles.boxValue}>{value}</Text>
      <Text style={styles.boxLabel}>{label}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { flex: 1, minWidth: '31%', padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  boxHi: { borderColor: p.neon },
  boxValue: { fontSize: 18, fontWeight: '900', color: p.neon },
  boxLabel: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  kv: { fontSize: 12, color: p.textMuted },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowLabel: { fontSize: 11, color: p.text, width: 90 },
  bar: { height: 12, backgroundColor: p.neon, borderRadius: 3 },
  rowValue: { fontSize: 11, color: p.textMuted, width: 30, textAlign: 'right' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
