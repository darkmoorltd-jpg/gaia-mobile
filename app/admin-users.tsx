import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const ONLINE_MS = 120_000;

function isOnline(lastSeen: string | null) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_MS;
}

type DetailTab = 'profile' | 'presence' | 'wallet' | 'payments' | 'sessions';

export default function AdminUsers() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s) => s.user);
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('profile');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) { console.warn('list error', error); setRows([]); }
      else { setRows(data || []); setLastUpdate(new Date()); }
    } catch (e) { console.log(e); }
    finally { setBusy(false); setRefreshing(false); }
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!isAdmin) return;
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [isAdmin, load]);

  const openDetail = async (row: any) => {
    setSelected(row);
    setDetail(null);
    setDetailTab('profile');
    setDetailBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_user_detail', { target_user_id: row.user_id });
      if (!error) setDetail(data);
    } catch {}
    setDetailBusy(false);
  };

  const changeScans = (row: any, delta: number) => {
    Alert.alert(
      (delta > 0 ? 'Add ' : 'Remove ') + Math.abs(delta) + ' scans',
      `For ${row.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setActionBusy(true);
            const { data, error } = await supabase.rpc('admin_add_scans', {
              target_user_id: row.user_id,
              delta,
              reason: 'admin panel',
            });
            setActionBusy(false);
            if (error) { Alert.alert('Failed', error.message); return; }
            Alert.alert('Updated', `New total: ${data}`);
            load();
            if (selected) openDetail(selected);
          },
        },
      ],
    );
  };

  const resetPassword = (row: any) => {
    Alert.alert('Send reset email', `Send password reset link to ${row.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Send',
        onPress: async () => {
          const { error } = await supabase.auth.resetPasswordForEmail(row.email);
          if (error) Alert.alert('Failed', error.message);
          else Alert.alert('Sent', 'Password reset email dispatched.');
        },
      },
    ]);
  };

 action  const deleteUser = (row: any) => {
    Alert.alert(
      'Delete user?',
      `Permanently remove ${row.email} and ALL their data. Cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'DELETE',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Absolutely sure?', 'This is irreversible.', [
              { text: 'NO', style: 'cancel' },
              {
                text: 'YES, DELETE',
                style: 'destructive',
                onPress: async () => {
                  setActionBusy(true);
                  const { error } = await supabase.rpc('admin_delete_user', { target_user_id: row.user_id });
                  setActionBusy(false);
                  if (error) { Alert.alert('Failed', error.message); return; }
                  setSelected(null);
                  setDetail(null);
                  load();
                },
              },
            ]);
          },
        },
      ],
    );
  };

  if (!isAdmin) {
    return (
      <View style={styles.blocked}>
        <Text style={styles.blockedText}>Access denied</Text>
      </View>
    );
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const hay = ((r.email || '') + ' ' + (r.first_name || '') + ' ' + (r.last_name || '') + ' ' + (r.state || '') + ' ' + (r.phone || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  const onlineCount = rows.filter((r) => isOnline(r.last_seen)).length;

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Users</Text>
        <Text style={styles.sub}>
          {rows.length} total · <Text style={{ color: palette.neon }}>{onlineCount} online</Text> · <Text style={{ color: palette.textDim, fontSize: 10 }}>updated {lastUpdate.toLocaleTimeString()}</Text>
        </Text>

        <View style={styles.searchWrap}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search name, email, phone, state…"
            placeholderTextColor={palette.textDim}
            style={styles.search}
            autoCapitalize="none"
          />
        </View>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}

        {filtered.map((r, i) => {
          const online = isOnline(r.last_seen);
          const name = ((r.first_name || '') + ' ' + (r.last_name || '')).trim() || (r.email ? r.email.split('@')[0] : 'Farmer');
          return (
            <Pressable key={r.user_id || i} onPress={() => openDetail(r)} style={styles.card}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{(name[0] || 'F').toUpperCase()}</Text>
                {online ? <View style={styles.dot} /> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{name}</Text>
                <Text style={styles.email} numberOfLines={1}>{r.email || '—'}</Text>
                <View style={styles.metaRow}>
                  {r.state ? <Text style={styles.meta}>{r.state}</Text> : null}
                  <Text style={styles.meta}>{r.scans_remaining} scans</Text>
                  <Text style={styles.meta}>{(r.plan || 'free').toUpperCase()}</Text>
                  {r.verification_status === 'approved' ? <Text style={[styles.meta, { color: palette.neon }]}>✓ verified</Text> : null}
                </View>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => { setSelected(null); setDetail(null); }}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            {!detail && detailBusy ? (
              <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} />
            ) : null}

            {detail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable onPress={() => { setSelected(null); setDetail(null); }}>
                  <Text style={styles.back}>CLOSE</Text>
                </Pressable>

                <Text style={styles.title} numberOfLines={1}>
                  {(detail.profile?.first_name || 'User') + ' ' + (detail.profile?.last_name || '')}
                </Text>
                <Text style={styles.sub}>{detail.user?.email}</Text>

                <View style={styles.tabBar}>
                  {(['profile', 'presence', 'wallet', 'payments', 'sessions'] as DetailTab[]).map((t) => (
                    <Pressable key={t} onPress={() => setDetailTab(t)} style={[styles.tabBtn, detailTab === t && styles.tabBtnActive]}>
                      <Text style={[styles.tabText, detailTab === t && styles.tabTextActive]}>
                        {t === 'profile' ? 'Profile' : t === 'presence' ? 'Status' : t === 'wallet' ? 'Wallet' : t === 'payments' ? 'Payments' : 'Chats'}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {detailTab === 'profile' ? (
                  <>
                    <Text style={styles.sectionLabel}>PERSONAL</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Email: </Text>{detail.user?.email}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Phone: </Text>{detail.profile?.phone || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>State: </Text>{detail.profile?.state || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>LGA: </Text>{detail.profile?.lga || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Gender: </Text>{detail.profile?.gender || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Crops: </Text>{detail.profile?.crops || detail.profile?.primary_crops || '—'}</Text>

                    <Text style={styles.sectionLabel}>ACCOUNT</Text>
                    <Text style={styles.kv}><Text style={styles.k}>User ID: </Text>{(detail.user?.id || '').slice(0, 16)}…</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Signed up: </Text>{detail.user?.created_at ? new Date(detail.user.created_at).toLocaleString() : '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Last sign-in: </Text>{detail.user?.last_sign_in_at ? new Date(detail.user.last_sign_in_at).toLocaleString() : '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Email confirmed: </Text>{detail.user?.email_confirmed_at ? new Date(detail.user.email_confirmed_at).toLocaleDateString() : 'no'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Scans: </Text>{detail.scans?.scans_remaining ?? 0} ({(detail.scans?.plan || 'free').toUpperCase()})</Text>
                    <Text style={styles.kv}><Text style={styles.k}>KYC: </Text>{detail.verification?.status || detail.profile?.verification_status || 'pending'}</Text>
                  </>
                ) : null}

                {detailTab === 'presence' ? (
                  <>
                    <Text style={styles.sectionLabel}>PRESENCE</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Status: </Text>{isOnline(detail.presence?.last_seen) ? 'Online' : 'Offline'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Last seen: </Text>{detail.presence?.last_seen ? new Date(detail.presence.last_seen).toLocaleString() : 'never'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Platform: </Text>{detail.presence?.platform || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Device: </Text>{detail.presence?.device_model || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>GPS: </Text>{detail.presence?.lat ? detail.presence.lat.toFixed(4) + ', ' + detail.presence.lon.toFixed(4) : '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>App version: </Text>{detail.presence?.app_version || '—'}</Text>
                  </>
                ) : null}

                {detailTab === 'wallet' ? (
                  <>
                    <Text style={styles.sectionLabel}>WALLET</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Balance: </Text>₦{Number(detail.wallet?.balance || 0).toLocaleString()}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Virtual acct: </Text>{detail.wallet?.virtual_account || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Bank: </Text>{detail.wallet?.account_bank || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Pending escrow: </Text>₦{Number(detail.wallet?.pending_escrow || 0).toLocaleString()}</Text>

                    <Text style={styles.sectionLabel}>LIFETIME</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Total paid: </Text>₦{Number((detail.payments || []).reduce((s: number, p: any) => s + Number(p.amount || 0), 0)).toLocaleString()}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Transactions: </Text>{(detail.payments || []).length}</Text>
                  </>
                ) : null}

                {detailTab === 'payments' ? (
                  <>
                    <Text style={styles.sectionLabel}>PAYMENT HISTORY</Text>
                    {(detail.payments || []).length === 0 ? (
                      <Text style={styles.kv}>No payments yet.</Text>
                    ) : (
                      detail.payments.map((p: any, i: number) => (
                        <View key={i} style={styles.payCard}>
                          <Text style={styles.payAmount}>₦{Number(p.amount || 0).toLocaleString()}</Text>
                          <Text style={styles.payMeta}>{(p.plan || '').toUpperCase()} · +{p.scans_added || 0} scans</Text>
                          <Text style={styles.payMeta}>Ref: {(p.reference || '').slice(0, 20)}…</Text>
                          <Text style={styles.payMeta}>{p.paid_at ? new Date(p.paid_at).toLocaleString() : ''}</Text>
                        </View>
                      ))
                    )}
                  </>
                ) : null}

                {detailTab === 'sessions' ? (
                  <>
                    <Text style={styles.sectionLabel}>CHAT SESSIONS</Text>
                    {(detail.sessions || []).length === 0 ? (
                      <Text style={styles.kv}>No chat sessions yet.</Text>
                    ) : (
                      detail.sessions.map((s: any, i: number) => (
                        <View key={i} style={styles.payCard}>
                          <Text style={styles.payAmount}>{s.count} messages</Text>
                          <Text style={styles.payMeta} numberOfLines={2}>{s.preview || '(empty)'}</Text>
                          <Text style={styles.payMeta}>{s.updated_at ? new Date(s.updated_at).toLocaleString() : ''}</Text>
                        </View>
                      ))
                    )}
                  </>
                ) : null}

                <Text style={styles.sectionLabel}>ACTIONS</Text>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, 50)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>+50 SCANS</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, 500)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>+500 SCANS</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, -50)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>-50 SCANS</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => resetPassword(selected)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>SEND PASSWORD RESET EMAIL</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => deleteUser(selected)} style={[styles.actionBtn, { borderColor: palette.danger }]}>
                  <Text style={[styles.actionTxt, { color: palette.danger }]}>DELETE USER</Text>
                </Pressable>

                <View style={{ height: 60 }} />
              </ScrollView>
            ) : null}
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
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  searchWrap: { backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: p.border },
  search: { paddingVertical: 12, color: p.text, fontSize: 14 },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: p.neonSoft, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  avatarTxt: { fontSize: 20, fontWeight: '900', color: p.neon },
  dot: { position: 'absolute', bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: p.neon, borderWidth: 2, borderColor: p.obsidian },
  name: { fontSize: 15, fontWeight: '700', color: p.text },
  email: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 4, flexWrap: 'wrap' },
  meta: { fontSize: 11, color: p.textMuted },
  chevron: { fontSize: 22, color: p.textDim },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '92%' },
  tabBar: { flexDirection: 'row', gap: 4, marginTop: 16, marginBottom: 12, backgroundColor: p.surface, borderRadius: 12, padding: 4 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 13, color: p.text, marginBottom: 6, lineHeight: 20 },
  k: { color: p.neon, fontWeight: '700' },
  payCard: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  payAmount: { fontSize: 16, fontWeight: '900', color: p.neon },
  payMeta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 10 },
  actionTxt: { fontSize: 13, fontWeight: '800', color: p.neon, letterSpacing: 1 },
});
