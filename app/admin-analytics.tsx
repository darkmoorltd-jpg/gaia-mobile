import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { useIsAdmin } from '../src/utils/admin';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
function fmtDate(s?: string) {
  if (!s) return '—';
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

export default function AdminAnalytics() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const { isAdmin, isSuperAdmin } = useIsAdmin();

  const [s, setS] = useState<any>({});
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [err, setErr] = useState('');
  const [drill, setDrill] = useState<{ title: string; rows: any[]; columns: { key: string; label: string; isDate?: boolean }[] } | null>(null);
  const [drillBusy, setDrillBusy] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true); setErr('');
    try {
      const { data, error } = await supabase.rpc('admin_kpi_dashboard');
      if (error) setErr(error.message); else setS(data || {});
    } catch (e: any) { setErr(e?.message || 'error'); }
    finally { setBusy(false); setRef(false); }
  }, [isAdmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDrill = async (title: string, rpc: string, params: any, columns: any[]) => {
    setDrill({ title, rows: [], columns });
    setDrillBusy(true);
    try {
      const { data } = await supabase.rpc(rpc, params);
      setDrill({ title, rows: Array.isArray(data) ? data : [], columns });
    } catch { setDrill({ title, rows: [], columns }); }
    setDrillBusy(false);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const money = (n: any) => 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

  // Reusable tile
  const T = (props: any) => (
    <Pressable
      onPress={props.onPress}
      disabled={!props.onPress}
      style={{
        width: '48%', padding: 18, borderRadius: 16,
        backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
        alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '900', color: props.accent || palette.neon }} numberOfLines={1}>
        {props.value}
      </Text>
      <Text style={{
        fontSize: 10, fontWeight: '700', letterSpacing: 1.5,
        color: palette.textMuted, marginTop: 6, textAlign: 'center',
      }}>{props.label}</Text>
      {props.onPress ? (
        <Text style={{ fontSize: 9, color: palette.textDim, marginTop: 4 }}>tap for details ›</Text>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Analytics</Text>
        <Text style={styles.sub}>Tap any tile for full list</Text>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {err ? <Text style={styles.err}>{err}</Text> : null}

        <Text style={styles.sectionLabel}>AUDIENCE</Text>
        <View style={styles.grid}>
          <T label="TOTAL USERS" value={s.users_total ?? 0} palette={palette}
             onPress={() => openDrill('All Users', 'admin_analytics_users', { p_segment: 'all' },
               [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'state',label:'State'},{key:'plan',label:'Plan'},{key:'created_at',label:'Signed up',isDate:true}])} />
          <T label="ONLINE NOW" value={s.users_online_now ?? 0} palette={palette} accent={palette.neon}
             onPress={() => openDrill('Online Now', 'admin_analytics_users', { p_segment: 'online_now' },
               [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'last_seen',label:'Last seen',isDate:true}])} />
          <T label="DAU" value={s.dau ?? 0} palette={palette}
             onPress={() => openDrill('Daily Active (24h)', 'admin_analytics_users', { p_segment: 'dau' },
               [{key:'email',label:'Email'},{key:'last_seen',label:'Last seen',isDate:true}])} />
          <T label="WAU" value={s.wau ?? 0} palette={palette}
             onPress={() => openDrill('Weekly Active (7d)', 'admin_analytics_users', { p_segment: 'wau' },
               [{key:'email',label:'Email'},{key:'last_seen',label:'Last seen',isDate:true}])} />
          <T label="MAU" value={s.mau ?? 0} palette={palette}
             onPress={() => openDrill('Monthly Active (30d)', 'admin_analytics_users', { p_segment: 'mau' },
               [{key:'email',label:'Email'},{key:'last_seen',label:'Last seen',isDate:true}])} />
          <T label="NEW 7D" value={s.users_new_7d ?? 0} palette={palette}
             onPress={() => openDrill('New Users (7d)', 'admin_analytics_users', { p_segment: 'new_7d' },
               [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'created_at',label:'Signed up',isDate:true}])} />
          <T label="NEW 30D" value={s.users_new_30d ?? 0} palette={palette}
             onPress={() => openDrill('New Users (30d)', 'admin_analytics_users', { p_segment: 'new_30d' },
               [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'created_at',label:'Signed up',isDate:true}])} />
          <T label="BANNED" value={s.users_banned ?? 0} palette={palette} accent={palette.danger}
             onPress={() => openDrill('Banned Users', 'admin_analytics_users', { p_segment: 'banned' },
               [{key:'email',label:'Email'},{key:'name',label:'Name'},{key:'state',label:'State'}])} />
        </View>

        <Text style={styles.sectionLabel}>REVENUE</Text>
        <View style={styles.grid}>
          <T label="REVENUE 7D" value={money(s.revenue_7d)} palette={palette} accent={palette.warning}
             onPress={() => openDrill('Payments (7d)', 'admin_analytics_payments', { p_days: 7 },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'plan',label:'Plan'},{key:'paid_at',label:'Paid at',isDate:true}])} />
          <T label="REVENUE 30D" value={money(s.revenue_30d)} palette={palette} accent={palette.warning}
             onPress={() => openDrill('Payments (30d)', 'admin_analytics_payments', { p_days: 30 },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'plan',label:'Plan'},{key:'paid_at',label:'Paid at',isDate:true}])} />
          <T label="REVENUE TOTAL" value={money(s.revenue_lifetime)} palette={palette} accent={palette.warning}
             onPress={() => openDrill('All Payments', 'admin_analytics_payments', { p_days: 0 },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'plan',label:'Plan'},{key:'paid_at',label:'Paid at',isDate:true}])} />
          <T label="PAYMENTS TOTAL" value={s.payments_count ?? 0} palette={palette}
             onPress={() => openDrill('All Payments', 'admin_analytics_payments', { p_days: 0 },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'paid_at',label:'Paid at',isDate:true}])} />
          <T label="PAYMENTS 30D" value={s.payments_30d ?? 0} palette={palette}
             onPress={() => openDrill('Payments (30d)', 'admin_analytics_payments', { p_days: 30 },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'paid_at',label:'Paid at',isDate:true}])} />
        </View>

        <Text style={styles.sectionLabel}>KYC</Text>
        <View style={styles.grid}>
          <T label="PENDING" value={s.kyc_pending ?? 0} palette={palette} accent={palette.warning}
             onPress={() => openDrill('KYC Pending', 'admin_analytics_kyc', { p_status: 'pending' },
               [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
          <T label="APPROVED" value={s.kyc_approved ?? 0} palette={palette}
             onPress={() => openDrill('KYC Approved', 'admin_analytics_kyc', { p_status: 'approved' },
               [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
          <T label="REJECTED" value={s.kyc_rejected ?? 0} palette={palette} accent={palette.danger}
             onPress={() => openDrill('KYC Rejected', 'admin_analytics_kyc', { p_status: 'rejected' },
               [{key:'full_name',label:'Name'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Submitted',isDate:true}])} />
        </View>

        <Text style={styles.sectionLabel}>AGENTS</Text>
        <View style={styles.grid}>
          <T label="TOTAL" value={s.agents_total ?? 0} palette={palette}
             onPress={() => openDrill('All Agents', 'admin_analytics_agents', { p_status: 'all' },
               [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'agent_code',label:'Code'},{key:'agent_zone',label:'Zone'},{key:'created_at',label:'Joined',isDate:true}])} />
          <T label="ACTIVE" value={s.agents_active ?? 0} palette={palette} accent={palette.neon}
             onPress={() => openDrill('Active Agents', 'admin_analytics_agents', { p_status: 'active' },
               [{key:'name',label:'Name'},{key:'email',label:'Email'},{key:'agent_code',label:'Code'},{key:'created_at',label:'Joined',isDate:true}])} />
          <T label="PENDING APPS" value={s.agent_apps_pending ?? 0} palette={palette} accent={palette.warning}
             onPress={() => openDrill('Pending Applications', 'admin_analytics_agent_apps', { p_status: 'pending' },
               [{key:'full_name',label:'Name'},{key:'email',label:'Email'},{key:'phone',label:'Phone'},{key:'state',label:'State'},{key:'created_at',label:'Applied',isDate:true}])} />
        </View>

        <Text style={styles.sectionLabel}>AI USAGE</Text>
        <View style={styles.grid}>
          <T label="SESSIONS" value={s.agronomist_sessions_total ?? 0} palette={palette}
             onPress={() => openDrill('Chat Sessions', 'admin_analytics_operations', { p_type: 'sessions' },
               [{key:'email',label:'User'},{key:'session_id',label:'Session'},{key:'message_count',label:'Msgs'},{key:'updated_at',label:'Last active',isDate:true}])} />
          <T label="MESSAGES" value={s.agronomist_messages_total ?? 0} palette={palette} />
          <T label="SCANS LEFT" value={s.scans_remaining_total ?? 0} palette={palette} />
        </View>

        <Text style={styles.sectionLabel}>MARKETPLACE</Text>
        <View style={styles.grid}>
          <T label="LISTINGS" value={s.listings_active ?? 0} palette={palette}
             onPress={() => openDrill('All Listings', 'admin_analytics_marketplace', { p_type: 'listings' },
               [{key:'title',label:'Title'},{key:'price',label:'Price'},{key:'quantity',label:'Qty'},{key:'location',label:'Location'},{key:'seller_email',label:'Seller'},{key:'created_at',label:'Listed',isDate:true}])} />
          <T label="ORDERS" value={s.orders_total ?? 0} palette={palette}
             onPress={() => openDrill('All Orders', 'admin_analytics_marketplace', { p_type: 'orders' },
               [{key:'order_ref',label:'Ref'},{key:'listing_title',label:'Item'},{key:'total',label:'Total'},{key:'status',label:'Status'},{key:'buyer_email',label:'Buyer'},{key:'created_at',label:'Ordered',isDate:true}])} />
          <T label="DISPUTES" value={s.disputes_open ?? 0} palette={palette} accent={palette.danger}
             onPress={() => openDrill('Open Disputes', 'admin_analytics_marketplace', { p_type: 'disputes' },
               [{key:'reason',label:'Reason'},{key:'status',label:'Status'},{key:'created_at',label:'Raised',isDate:true}])} />
        </View>

        <Text style={styles.sectionLabel}>OPERATIONS</Text>
        <View style={styles.grid}>
          <T label="TICKETS OPEN" value={s.tickets_open ?? 0} palette={palette}
             onPress={() => openDrill('Open Tickets', 'admin_analytics_operations', { p_type: 'tickets' },
               [{key:'email',label:'User'},{key:'subject',label:'Subject'},{key:'status',label:'Status'},{key:'created_at',label:'Opened',isDate:true}])} />
          <T label="WITHDRAWALS" value={s.withdrawals_pending ?? 0} palette={palette}
             onPress={() => openDrill('Pending Withdrawals', 'admin_analytics_operations', { p_type: 'withdrawals' },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'status',label:'Status'},{key:'requested_at',label:'Requested',isDate:true}])} />
          <T label="WD PENDING" value={money(s.withdrawals_pending_amount)} palette={palette} accent={palette.warning}
             onPress={() => openDrill('Pending Withdrawals', 'admin_analytics_operations', { p_type: 'withdrawals' },
               [{key:'email',label:'User'},{key:'amount',label:'Amount'},{key:'requested_at',label:'Requested',isDate:true}])} />
          <T label="BADGES ACTIVE" value={s.badges_active ?? 0} palette={palette}
             onPress={() => openDrill('Active Badges', 'admin_analytics_operations', { p_type: 'badges' },
               [{key:'email',label:'User'},{key:'badge_tier',label:'Tier'},{key:'subscribed_at',label:'Since',isDate:true},{key:'expires_at',label:'Expires',isDate:true}])} />
        </View>

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!drill} animationType="slide" transparent onRequestClose={() => setDrill(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setDrill(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title} numberOfLines={1}>{drill?.title}</Text>
            <Text style={styles.sub}>{drill?.rows.length ?? 0} record(s)</Text>

            {drillBusy ? <ActivityIndicator color={palette.neon} /> : null}

            <ScrollView style={{ maxHeight: '80%' }}>
              {(drill?.rows || []).map((row, i) => (
                <View key={i} style={styles.rowCard}>
                  {(drill?.columns || []).map((c) => (
                    <View key={c.key} style={styles.rowLine}>
                      <Text style={styles.rowLabel}>{c.label}</Text>
                      <Text style={styles.rowValue} numberOfLines={2}>
                        {c.isDate ? fmtDate(row[c.key]) : String(row[c.key] ?? '—')}
                      </Text>
                    </View>
                  ))}
                </View>
              ))}
              {(drill?.rows || []).length === 0 && !drillBusy ? (
                <Text style={styles.empty}>No records.</Text>
              ) : null}
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  err: { color: p.danger, fontSize: 12, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 10 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: '92%' },
  rowCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  rowLabel: { fontSize: 11, color: p.textMuted, flex: 1 },
  rowValue: { fontSize: 12, color: p.text, flex: 1.4, textAlign: 'right' },
  empty: { textAlign: 'center', color: p.textMuted, marginTop: 30, fontSize: 13 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});