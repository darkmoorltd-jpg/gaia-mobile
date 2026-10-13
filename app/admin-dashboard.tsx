import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const NGN = (n: any) => '₦' + Number(n || 0).toLocaleString();

function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return String(s); }
}

type Column = { key: string; label: string; isDate?: boolean; money?: boolean };

export default function AdminDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [kpi, setKpi] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modal, setModal] = useState<{ title: string; rpc: string; params: any; columns: Column[] } | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [modalBusy, setModalBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { data } = await supabase.rpc('admin_kpi_dashboard');
      if (data) setKpi(data);
    } catch {}
    setBusy(false); setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!isAdmin) return; const t = setInterval(load, 30000); return () => clearInterval(t); }, [isAdmin, load]);

  const openDrill = async (title: string, rpc: string, params: any, columns: Column[]) => {
    setModal({ title, rpc, params, columns });
    setRows([]);
    setModalBusy(true);
    try {
      const { data, error } = await supabase.rpc(rpc, params);
      if (error) console.warn('[drill]', error.message);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) { console.warn('[drill]', e); }
    setModalBusy(false);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const Box = ({ label, value, highlight, onPress }: any) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.box, highlight && styles.boxHi]}
    >
      <Text style={styles.boxValue} numberOfLines={1}>{value ?? 0}</Text>
      <Text style={styles.boxLabel}>{label}</Text>
      {onPress ? <Text style={styles.boxHint}>tap ›</Text> : null}
    </Pressable>
  );

  const K = kpi || {};

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.sub}>Tap any tile for details · refresh 30s</Text>

        {busy && !kpi ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {kpi ? (
          <>
            <Text style={styles.sectionLabel}>USERS</Text>
            <View style={styles.grid}>
              <Box label="TOTAL" value={K.users_total}
                   onPress={() => openDrill('All Users', 'admin_analytics_users', { p_segment: 'all' },
                     [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'state',label:'State'},{key:'plan',label:'Plan'},{key:'created_at',label:'Signed up',isDate:true}])} />
              <Box label="ONLINE NOW" value={K.users_online_now} highlight
                   onPress={() => openDrill('Online Now', 'admin_analytics_users', { p_segment: 'online_now' },
                     [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'last_seen',label:'Last seen',isDate:true}])} />
              <Box label="+7D" value={K.users_new_7d}
                   onPress={() => openDrill('New Users (7d)', 'admin_analytics_users', { p_segment: 'new_7d' },
                     [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'created_at',label:'Signed up',isDate:true}])} />
              <Box label="+30D" value={K.users_new_30d}
                   onPress={() => openDrill('New Users (30d)', 'admin_analytics_users', { p_segment: 'new_30d' },
                     [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'created_at',label:'Signed up',isDate:true}])} />
              <Box label="BANNED" value={K.users_banned}
                   onPress={() => openDrill('Banned Users', 'admin_analytics_users', { p_segment: 'banned' },
                     [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'state',label:'State'}])} />
            </View>

            <Text style={styles.sectionLabel}>REVENUE</Text>
            <View style={styles.grid}>
              <Box label="LIFETIME" value={NGN(K.revenue_lifetime)} highlight
                   onPress={() => openDrill('All Payments', 'admin_analytics_payments', { p_days: 0 },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'plan',label:'Plan'},{key:'paid_at',label:'Paid at',isDate:true}])} />
              <Box label="30D" value={NGN(K.revenue_30d)}
                   onPress={() => openDrill('Payments (30d)', 'admin_analytics_payments', { p_days: 30 },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'paid_at',label:'Paid at',isDate:true}])} />
              <Box label="7D" value={NGN(K.revenue_7d)}
                   onPress={() => openDrill('Payments (7d)', 'admin_analytics_payments', { p_days: 7 },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'paid_at',label:'Paid at',isDate:true}])} />
              <Box label="PAYMENTS 30D" value={K.payments_30d}
                   onPress={() => openDrill('Payments (30d)', 'admin_analytics_payments', { p_days: 30 },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'paid_at',label:'Paid at',isDate:true}])} />
            </View>

            <Text style={styles.sectionLabel}>KYC</Text>
            <View style={styles.grid}>
              <Box label="PENDING" value={K.kyc_pending} highlight
                   onPress={() => openDrill('KYC Pending', 'admin_analytics_kyc', { p_status: 'pending' },
                     [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
              <Box label="APPROVED" value={K.kyc_approved}
                   onPress={() => openDrill('KYC Approved', 'admin_analytics_kyc', { p_status: 'approved' },
                     [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
              <Box label="REJECTED" value={K.kyc_rejected}
                   onPress={() => openDrill('KYC Rejected', 'admin_analytics_kyc', { p_status: 'rejected' },
                     [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
            </View>

            <Text style={styles.sectionLabel}>AGENTS</Text>
            <View style={styles.grid}>
              <Box label="TOTAL" value={K.agents_total ?? '—'}
                   onPress={() => openDrill('All Agents', 'admin_analytics_agents', { p_status: 'all' },
                     [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'agent_code',label:'Code'},{key:'agent_zone',label:'Zone'},{key:'created_at',label:'Joined',isDate:true}])} />
              <Box label="ACTIVE" value={K.agents_active ?? '—'} highlight
                   onPress={() => openDrill('Active Agents', 'admin_analytics_agents', { p_status: 'active' },
                     [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'agent_code',label:'Code'},{key:'agent_zone',label:'Zone'},{key:'created_at',label:'Joined',isDate:true}])} />
              <Box label="PENDING APPS" value={K.agent_apps_pending ?? '—'}
                   onPress={() => openDrill('Pending Applications', 'admin_analytics_agent_apps', { p_status: 'pending' },
                     [{key:'full_name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Applied',isDate:true}])} />
            </View>

            <Text style={styles.sectionLabel}>MARKETPLACE</Text>
            <View style={styles.grid}>
              <Box label="LISTINGS" value={K.listings_active}
                   onPress={() => openDrill('All Listings', 'admin_analytics_marketplace', { p_type: 'listings' },
                     [{key:'title',label:'Title'},{key:'price',label:'Price',money:true},{key:'quantity',label:'Qty'},{key:'location',label:'Location'},{key:'seller_email',label:'Seller'},{key:'created_at',label:'Listed',isDate:true}])} />
              <Box label="ORDERS" value={K.orders_total}
                   onPress={() => openDrill('All Orders', 'admin_analytics_marketplace', { p_type: 'orders' },
                     [{key:'order_ref',label:'Ref'},{key:'listing_title',label:'Item'},{key:'total',label:'Total',money:true},{key:'status',label:'Status'},{key:'buyer_email',label:'Buyer'},{key:'created_at',label:'Ordered',isDate:true}])} />
              <Box label="DISPUTES" value={K.disputes_open} highlight
                   onPress={() => openDrill('Open Disputes', 'admin_analytics_marketplace', { p_type: 'disputes' },
                     [{key:'reason',label:'Reason'},{key:'status',label:'Status'},{key:'created_at',label:'Raised',isDate:true}])} />
            </View>

            <Text style={styles.sectionLabel}>OPERATIONS</Text>
            <View style={styles.grid}>
              <Box label="TICKETS OPEN" value={K.tickets_open}
                   onPress={() => openDrill('Open Tickets', 'admin_analytics_operations', { p_type: 'tickets' },
                     [{key:'email',label:'User'},{key:'subject',label:'Subject'},{key:'status',label:'Status'},{key:'created_at',label:'Opened',isDate:true}])} />
              <Box label="WITHDRAWALS" value={K.withdrawals_pending}
                   onPress={() => openDrill('Pending Withdrawals', 'admin_analytics_operations', { p_type: 'withdrawals' },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'status',label:'Status'},{key:'requested_at',label:'Requested',isDate:true}])} />
              <Box label="WD ₦ PENDING" value={NGN(K.withdrawals_pending_amount)}
                   onPress={() => openDrill('Pending Withdrawals', 'admin_analytics_operations', { p_type: 'withdrawals' },
                     [{key:'email',label:'User'},{key:'amount',label:'Amount',money:true},{key:'requested_at',label:'Requested',isDate:true}])} />
              <Box label="BADGES ACTIVE" value={K.badges_active}
                   onPress={() => openDrill('Active Badges', 'admin_analytics_operations', { p_type: 'badges' },
                     [{key:'email',label:'User'},{key:'badge_tier',label:'Tier'},{key:'subscribed_at',label:'Since',isDate:true},{key:'expires_at',label:'Expires',isDate:true}])} />
            </View>

            <Text style={styles.sectionLabel}>AI USAGE</Text>
            <View style={styles.grid}>
              <Box label="SCANS LEFT" value={K.scans_remaining_total} />
              <Box label="SESSIONS" value={K.agronomist_sessions_total}
                   onPress={() => openDrill('Chat Sessions', 'admin_analytics_operations', { p_type: 'sessions' },
                     [{key:'email',label:'User'},{key:'session_id',label:'Session'},{key:'message_count',label:'Msgs'},{key:'updated_at',label:'Last active',isDate:true}])} />
              <Box label="MESSAGES" value={K.agronomist_messages_total} />
            </View>

            <Text style={styles.sectionLabel}>TOP STATES</Text>
            {(K.top_states || []).length === 0 ? <Text style={styles.kv}>No location data.</Text> :
              (K.top_states || []).map((s: any, i: number) => (
                <View key={i} style={styles.row2}>
                  <Text style={styles.rowLabel}>{s.state}</Text>
                  <View style={[styles.bar, { flex: s.n }]} />
                  <Text style={styles.rowValue}>{s.n}</Text>
                </View>
              ))}

            <Text style={styles.sectionLabel}>SIGNUPS (30D)</Text>
            {(K.signups_daily || []).length === 0 ? <Text style={styles.kv}>No signups.</Text> :
              (K.signups_daily || []).map((d: any, i: number) => (
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

      {/* Drill-down modal */}
      <Modal visible={!!modal} animationType="slide" transparent onRequestClose={() => setModal(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setModal(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title} numberOfLines={1}>{modal?.title}</Text>
            <Text style={styles.sub}>{rows.length} record(s)</Text>

            {modalBusy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

            <ScrollView style={{ maxHeight: '76%' }}>
              {rows.map((r, i) => (
                <View key={i} style={styles.rowCard}>
                  {(modal?.columns || []).map((c) => (
                    <View key={c.key} style={styles.line}>
                      <Text style={styles.lineL}>{c.label}</Text>
                      <Text style={styles.lineV} numberOfLines={2}>
                        {c.isDate ? fmtDate(r[c.key])
                          : c.money ? NGN(r[c.key])
                          : String(r[c.key] ?? '—')}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              {!modalBusy && rows.length === 0 ? <Text style={styles.empty}>No records.</Text> : null}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  box: { flex: 1, minWidth: '31%', padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  boxHi: { borderColor: p.neon },
  boxValue: { fontSize: 18, fontWeight: '900', color: p.neon },
  boxLabel: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  boxHint: { fontSize: 8, color: p.textDim, marginTop: 4 },
  kv: { fontSize: 12, color: p.textMuted },
  row2: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  rowLabel: { fontSize: 11, color: p.text, width: 90 },
  bar: { height: 12, backgroundColor: p.neon, borderRadius: 3 },
  rowValue: { fontSize: 11, color: p.textMuted, width: 30, textAlign: 'right' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  rowCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  line: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  lineL: { fontSize: 11, color: p.textMuted, flex: 1 },
  lineV: { fontSize: 12, color: p.text, flex: 1.5, textAlign: 'right' },
  empty: { textAlign: 'center', color: p.textMuted, marginTop: 30, fontSize: 13 },
});
