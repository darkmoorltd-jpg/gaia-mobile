import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminAnalytics() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [s, setS] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_kpi_dashboard');
      if (error) setErr(error.message);
      else setS(data || {});
    } catch (e: any) { setErr(e?.message || 'error'); }
    finally { setBusy(false); setRef(false); }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Live platform metrics · pull to refresh</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Text style={styles.sectionLabel}>AUDIENCE</Text>
        <View style={styles.grid}>
          <Metric label="TOTAL USERS" value={s.users_total ?? 0} palette={palette} />
          <Metric label="ONLINE NOW" value={s.users_online_now ?? 0} palette={palette} accent={palette.neon} />
          <Metric label="DAU" value={s.dau ?? 0} palette={palette} />
          <Metric label="WAU" value={s.wau ?? 0} palette={palette} />
          <Metric label="MAU" value={s.mau ?? 0} palette={palette} />
          <Metric label="NEW 7D" value={s.users_new_7d ?? 0} palette={palette} />
          <Metric label="NEW 30D" value={s.users_new_30d ?? 0} palette={palette} />
          <Metric label="BANNED" value={s.users_banned ?? 0} palette={palette} accent={palette.danger} />
        </View>

        <Text style={styles.sectionLabel}>REVENUE</Text>
        <View style={styles.grid}>
          <Metric label="REVENUE 7D" value={money(s.revenue_7d)} palette={palette} accent={palette.warning} />
          <Metric label="REVENUE 30D" value={money(s.revenue_30d)} palette={palette} accent={palette.warning} />
          <Metric label="REVENUE TOTAL" value={money(s.revenue_lifetime)} palette={palette} accent={palette.warning} />
          <Metric label="PAYMENTS TOTAL" value={s.payments_count ?? 0} palette={palette} />
          <Metric label="PAYMENTS 30D" value={s.payments_30d ?? 0} palette={palette} />
        </View>

        <Text style={styles.sectionLabel}>KYC</Text>
        <View style={styles.grid}>
          <Metric label="PENDING" value={s.kyc_pending ?? 0} palette={palette} accent={palette.warning} />
          <Metric label="APPROVED" value={s.kyc_approved ?? 0} palette={palette} />
          <Metric label="REJECTED" value={s.kyc_rejected ?? 0} palette={palette} accent={palette.danger} />
        </View>

        <Text style={styles.sectionLabel}>AGENTS</Text>
        <View style={styles.grid}>
          <Metric label="TOTAL" value={s.agents_total ?? 0} palette={palette} />
          <Metric label="ACTIVE" value={s.agents_active ?? 0} palette={palette} accent={palette.neon} />
          <Metric label="PENDING APPS" value={s.agent_apps_pending ?? 0} palette={palette} accent={palette.warning} />
        </View>

        <Text style={styles.sectionLabel}>AI USAGE</Text>
        <View style={styles.grid}>
          <Metric label="SESSIONS" value={s.agronomist_sessions_total ?? 0} palette={palette} />
          <Metric label="MESSAGES" value={s.agronomist_messages_total ?? 0} palette={palette} />
          <Metric label="SCANS LEFT" value={s.scans_remaining_total ?? 0} palette={palette} />
        </View>

        <Text style={styles.sectionLabel}>MARKETPLACE</Text>
        <View style={styles.grid}>
          <Metric label="LISTINGS" value={s.listings_active ?? 0} palette={palette} />
          <Metric label="ORDERS" value={s.orders_total ?? 0} palette={palette} />
          <Metric label="PENDING" value={s.orders_pending ?? 0} palette={palette} accent={palette.warning} />
          <Metric label="DISPUTES" value={s.disputes_open ?? 0} palette={palette} accent={palette.danger} />
        </View>

        <Text style={styles.sectionLabel}>OPERATIONS</Text>
        <View style={styles.grid}>
          <Metric label="TICKETS OPEN" value={s.tickets_open ?? 0} palette={palette} />
          <Metric label="WITHDRAWALS" value={s.withdrawals_pending ?? 0} palette={palette} />
          <Metric label="WD PENDING" value={money(s.withdrawals_pending_amount)} palette={palette} accent={palette.warning} />
          <Metric label="BADGES ACTIVE" value={s.badges_active ?? 0} palette={palette} />
        </View>

        {s.top_states?.length ? (
          <>
            <Text style={styles.sectionLabel}>TOP STATES</Text>
            {s.top_states.map((x: any) => (
              <View key={x.state} style={styles.barRow}>
                <Text style={styles.barLabel}>{x.state}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, x.n * 5) + '%' }]} />
                </View>
                <Text style={styles.barVal}>{x.n}</Text>
              </View>
            ))}
          </>
        ) : null}

        {s.signups_daily?.length ? (
          <>
            <Text style={styles.sectionLabel}>SIGNUPS (30D)</Text>
            {s.signups_daily.map((x: any) => (
              <View key={String(x.day)} style={styles.barRow}>
                <Text style={styles.barLabel}>{String(x.day).slice(5)}</Text>
                <View style={styles.barBg}>
                  <View style={[styles.barFill, { width: Math.min(100, x.n * 10) + '%' }]} />
                </View>
                <Text style={styles.barVal}>{x.n}</Text>
              </View>
            ))}
          </>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function Metric({ label, value, palette, accent }: any) {
  return (
    <View style={{
      width: '48%', padding: 18, borderRadius: 16,
      backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: 20, fontWeight: '900', color: accent || palette.neon }} numberOfLines={1}>
        {value}
      </Text>
      <Text style={{
        fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
        color: palette.textMuted, marginTop: 6, textAlign: 'center',
      }}>{label}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  err: { color: p.danger, fontSize: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { width: 90, fontSize: 11, color: p.text },
  barBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4 },
  barFill: { height: '100%', backgroundColor: p.neon, borderRadius: 4 },
  barVal: { width: 40, fontSize: 11, color: p.text, textAlign: 'right' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
