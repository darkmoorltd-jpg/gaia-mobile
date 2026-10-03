import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  Modal, Alert, ActivityIndicator, RefreshControl, Image, Linking,
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

function fmtDate(iso?: string) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString(); } catch { return '—'; }
}

type Tab = 'profile' | 'market' | 'kyc' | 'badges' | 'memory' | 'support' | 'payments' | 'chats';

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
  const [tab, setTab] = useState<Tab>('profile');
  const [replyDraft, setReplyDraft] = useState<Record<string, string>>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_list_users');
      if (error) { console.warn(error); setRows([]); }
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
    setTab('profile');
    setDetailBusy(true);
    try {
      const { data, error } = await supabase.rpc('admin_user_detail', { target_user_id: row.user_id });
      if (!error) setDetail(data);
    } catch {}
    setDetailBusy(false);
  };

  const refreshDetail = async () => {
    if (!selected) return;
    const { data } = await supabase.rpc('admin_user_detail', { target_user_id: selected.user_id });
    if (data) setDetail(data);
  };

  const changeScans = (row: any, delta: number) => {
    Alert.alert(
      (delta > 0 ? 'Add ' : 'Remove ') + Math.abs(delta) + ' scans',
      `For ${row.email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setActionBusy(true);
          const { data, error } = await supabase.rpc('admin_add_scans', {
            target_user_id: row.user_id, delta, reason: 'admin panel',
          });
          setActionBusy(false);
          if (error) { Alert.alert('Failed', error.message); return; }
          Alert.alert('Updated', `New total: ${data}`);
          load(); refreshDetail();
        }},
      ],
    );
  };

  const resetPassword = (row: any) => {
    Alert.alert('Send reset email', `Send password reset link to ${row.email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        const { error } = await supabase.auth.resetPasswordForEmail(row.email);
        if (error) Alert.alert('Failed', error.message);
        else Alert.alert('Sent', 'Password reset email dispatched.');
      }},
    ]);
  };

  const deleteUser = (row: any) => {
    Alert.alert('Delete user?', `Permanently remove ${row.email} and ALL their data?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: () => {
        Alert.alert('Absolutely sure?', 'Cannot be undone.', [
          { text: 'NO', style: 'cancel' },
          { text: 'YES, DELETE', style: 'destructive', onPress: async () => {
            setActionBusy(true);
            const { error } = await supabase.rpc('admin_delete_user', { target_user_id: row.user_id });
            setActionBusy(false);
            if (error) { Alert.alert('Failed', error.message); return; }
            setSelected(null); setDetail(null); load();
          }},
        ]);
      }},
    ]);
  };

  const promptWallet = (row: any, amount: number) => {
    Alert.alert(
      (amount > 0 ? 'Credit ' : 'Debit ') + '₦' + Math.abs(amount).toLocaleString(),
      'For ' + row.email + '?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
          setActionBusy(true);
          const { data, error } = await supabase.rpc('admin_adjust_wallet', {
            p_user_id: row.user_id, p_amount: amount, p_note: 'admin panel',
          });
          setActionBusy(false);
          if (error) Alert.alert('Failed', error.message);
          else { Alert.alert('Done', 'New balance: ₦' + Number(data || 0).toLocaleString()); refreshDetail(); }
        }},
      ],
    );
  };

  const grantBadge = (row: any, tier: string, days: number) => {
    Alert.alert('Grant ' + tier + ' for ' + days + 'd?', 'For ' + row.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Grant', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_grant_badge', { p_user_id: row.user_id, p_tier: tier, p_days: days });
        setActionBusy(false);
        if (error) Alert.alert('Failed', error.message); else refreshDetail();
      }},
    ]);
  };

  const revokeBadge = (row: any) => {
    Alert.alert('Revoke badge?', 'Removes current badge for ' + row.email, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_revoke_badge', { p_user_id: row.user_id });
        setActionBusy(false);
        if (error) Alert.alert('Failed', error.message); else refreshDetail();
      }},
    ]);
  };

  const promptBan = (row: any, hours: number) => {
    const label = hours >= 999999 ? 'forever' : hours + 'h';
    Alert.alert('Ban ' + row.email + ' ' + label + '?', 'They will be signed out.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'BAN', style: 'destructive', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_ban_user', {
          p_user_id: row.user_id, p_hours: hours, p_reason: 'admin action',
        });
        setActionBusy(false);
        if (error) Alert.alert('Failed', error.message);
        else { Alert.alert('Banned', 'Until ' + (hours >= 999999 ? 'forever' : hours + 'h from now')); refreshDetail(); }
      }},
    ]);
  };

  const unban = (row: any) => {
    Alert.alert('Unban ' + row.email + '?', '', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unban', onPress: async () => {
        setActionBusy(true);
        const { error } = await supabase.rpc('admin_unban_user', { p_user_id: row.user_id });
        setActionBusy(false);
        if (error) Alert.alert('Failed', error.message); else refreshDetail();
      }},
    ]);
  };

  const sendDM = (row: any) => {
    router.push(('/chat-room?uid=' + row.user_id) as any);
  };

  const sendSupportReply = async (ticketId: string) => {
    const reply = (replyDraft[ticketId] || '').trim();
    if (!reply) return;
    setActionBusy(true);
    const { error } = await supabase.rpc('admin_reply_support', { p_ticket_id: ticketId, p_reply: reply });
    setActionBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setReplyDraft((d) => ({ ...d, [ticketId]: '' }));
    refreshDetail();
  };

  const closeSupport = async (ticketId: string) => {
    setActionBusy(true);
    const { error } = await supabase.rpc('admin_close_support', { p_ticket_id: ticketId });
    setActionBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    refreshDetail();
  };

  if (!isAdmin) {
    return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;
  }

  const filtered = search.trim()
    ? rows.filter((r) => {
        const hay = ((r.email || '') + ' ' + (r.first_name || '') + ' ' + (r.last_name || '') + ' ' + (r.state || '') + ' ' + (r.phone || '')).toLowerCase();
        return hay.includes(search.toLowerCase());
      })
    : rows;

  const onlineCount = rows.filter((r) => isOnline(r.last_seen)).length;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile',  label: 'Profile' },
    { key: 'market',   label: 'Market' },
    { key: 'kyc',      label: 'KYC' },
    { key: 'badges',   label: 'Badges' },
    { key: 'memory',   label: 'Memory' },
    { key: 'support',  label: 'Support' },
    { key: 'payments', label: 'Payments' },
    { key: 'chats',    label: 'Chats' },
  ];

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
          <TextInput value={search} onChangeText={setSearch}
            placeholder="Search name, email, phone, state…"
            placeholderTextColor={palette.textDim}
            style={styles.search} autoCapitalize="none" />
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
                  {r.verification_status === 'approved' ? <Text style={[styles.meta, { color: palette.neon }]}>verified</Text> : null}
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
            {!detail && detailBusy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

            {detail ? (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Pressable onPress={() => { setSelected(null); setDetail(null); }}>
                  <Text style={styles.back}>CLOSE</Text>
                </Pressable>

                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.title} numberOfLines={1}>
                      {(detail.profile?.first_name || 'User') + ' ' + (detail.profile?.last_name || '')}
                    </Text>
                    <Text style={styles.sub} numberOfLines={1}>{detail.user?.email}</Text>
                  </View>
                  <View style={styles.roleChip}>
                    <Text style={styles.roleText}>{(detail.marketplace_role || 'none').toUpperCase()}</Text>
                  </View>
                </View>

                <Pressable onPress={() => sendDM(selected)} style={[styles.dmBtn, { borderColor: palette.neon }]}>
                  <Text style={[styles.dmText, { color: palette.neon }]}>OPEN DIRECT CHAT</Text>
                </Pressable>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar} contentContainerStyle={styles.tabBarInner}>
                  {TABS.map((t) => (
                    <Pressable key={t.key} onPress={() => setTab(t.key)}
                      style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}>
                      <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* ============ PROFILE ============ */}
                {tab === 'profile' ? (
                  <>
                    <Text style={styles.sectionLabel}>PERSONAL</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Email: </Text>{detail.user?.email}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Phone: </Text>{detail.profile?.phone || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>WhatsApp: </Text>{detail.profile?.whatsapp || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Gender: </Text>{detail.profile?.gender || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>State: </Text>{detail.profile?.state || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>LGA: </Text>{detail.profile?.lga || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>City: </Text>{detail.profile?.city || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Address: </Text>{detail.profile?.street_address || '—'}</Text>

                    <Text style={styles.sectionLabel}>ACCOUNT</Text>
                    <Text style={styles.kv}><Text style={styles.k}>User ID: </Text>{(detail.user?.id || '').slice(0, 18)}…</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Signed up: </Text>{fmtDate(detail.user?.created_at)}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Last sign-in: </Text>{fmtDate(detail.user?.last_sign_in_at)}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Email confirmed: </Text>{fmtDate(detail.user?.email_confirmed_at)}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Scans: </Text>{detail.scans?.scans_remaining ?? 0} ({(detail.scans?.plan || 'free').toUpperCase()})</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Marketplace role: </Text>{(detail.marketplace_role || 'none').toUpperCase()}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>KYC: </Text>{detail.verification?.status || detail.profile?.verification_status || 'pending'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Active badge: </Text>{
                      (() => {
                        const active = (detail.badges || []).find((b: any) => b.expires_at && new Date(b.expires_at) > new Date());
                        return active ? `${(active.badge_tier || '').toUpperCase()} until ${fmtDate(active.expires_at)}` : 'none';
                      })()
                    }</Text>

                    <Text style={styles.sectionLabel}>STATUS</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Online: </Text>{isOnline(detail.presence?.last_seen) ? 'Yes' : 'No'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Last seen: </Text>{fmtDate(detail.presence?.last_seen)}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Platform: </Text>{detail.presence?.platform || '—'}</Text>
                    <Text style={styles.kv}><Text style={styles.k}>Device: </Text>{detail.presence?.device_model || '—'}</Text>
                  </>
                ) : null}

                {/* ============ MARKETPLACE ============ */}
                {tab === 'market' ? (
                  <>
                    <Text style={styles.sectionLabel}>ROLE</Text>
                    <Text style={styles.kv}>
                      <Text style={styles.k}>Acts as: </Text>
                      <Text style={{ color: palette.neon, fontWeight: '900' }}>
                        {(detail.marketplace_role || 'none').toUpperCase()}
                      </Text>
                    </Text>

                    <Text style={styles.sectionLabel}>LISTINGS ({(detail.listings || []).length})</Text>
                    {(detail.listings || []).length === 0 ? <Text style={styles.kv}>No listings.</Text> :
                      (detail.listings || []).map((l: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>{l.title || 'Item'}</Text>
                          <Text style={styles.card2Meta}>₦{Number(l.price || 0).toLocaleString()} / {l.unit || 'unit'} · qty {l.quantity || 0} · sold {l.sold || 0}</Text>
                          <Text style={styles.card2Meta}>Category: {l.category || '—'} · {fmtDate(l.created_at)}</Text>
                          {l.state ? <Text style={styles.card2Meta}>📍 {l.location || '—'}</Text> : null}
                        </View>
                      ))}

                    <Text style={styles.sectionLabel}>BUY ORDERS ({(detail.buy_orders || []).length})</Text>
                    {(detail.buy_orders || []).length === 0 ? <Text style={styles.kv}>No purchases.</Text> :
                      (detail.buy_orders || []).map((o: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>₦{Number(o.total || 0).toLocaleString()}</Text>
                          <Text style={styles.card2Meta}>Qty: {o.quantity} · Status: {(o.status || '').toUpperCase()}</Text>
                          <Text style={styles.card2Meta}>Delivery: {o.delivery_method || 'pickup'} · Fee ₦{o.delivery_fee || 0} · {o.listing_title || ''}</Text>
                          <Text style={styles.card2Meta}>Ref: {(o.payment_ref || o.order_ref || '').slice(0, 22)}</Text>
                          <Text style={styles.card2Meta}>{fmtDate(o.created_at)}</Text>
                        </View>
                      ))}

                    <Text style={styles.sectionLabel}>SELL ORDERS ({(detail.sell_orders || []).length})</Text>
                    {(detail.sell_orders || []).length === 0 ? <Text style={styles.kv}>No sales.</Text> :
                      (detail.sell_orders || []).map((o: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>₦{Number(o.total || 0).toLocaleString()}</Text>
                          <Text style={styles.card2Meta}>Qty: {o.quantity} · Status: {(o.status || '').toUpperCase()}</Text>
                          <Text style={styles.card2Meta}>Ref: {(o.payment_ref || o.order_ref || '').slice(0, 22)}</Text>
                          <Text style={styles.card2Meta}>{fmtDate(o.created_at)}</Text>
                        </View>
                      ))}
                  </>
                ) : null}

                {/* ============ KYC ============ */}
                {tab === 'kyc' ? (
                  <>
                    {!detail.verification ? (
                      <Text style={styles.kv}>No verification submitted.</Text>
                    ) : (
                      <>
                        <Text style={styles.sectionLabel}>STATUS</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Status: </Text>{(detail.verification.status || 'pending').toUpperCase()}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Payment: </Text>{detail.verification.payment_status || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Ref: </Text>{(detail.verification.payment_reference || '').slice(0, 24)}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Submitted: </Text>{fmtDate(detail.verification.created_at)}</Text>

                        <Text style={styles.sectionLabel}>FORM</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Full name: </Text>{detail.verification.full_name || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Phone: </Text>{detail.verification.phone || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>State: </Text>{detail.verification.state || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>LGA: </Text>{detail.verification.lga || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Address: </Text>{detail.verification.address || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>Crops: </Text>{detail.verification.crops || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>ID type: </Text>{detail.verification.id_type || detail.verification.govt_id_type || '—'}</Text>
                        <Text style={styles.kv}><Text style={styles.k}>ID number: </Text>{detail.verification.id_number || detail.verification.govt_id_number || '—'}</Text>

                        <Text style={styles.sectionLabel}>IMAGES</Text>
                        {detail.verification.id_image_url ? (
                          <View style={styles.imgBox}>
                            <Text style={styles.imgLabel}>ID</Text>
                            <Image source={{ uri: detail.verification.id_image_url }} style={styles.img} resizeMode="contain" />
                            <Pressable onPress={() => Linking.openURL(detail.verification.id_image_url)}>
                              <Text style={[styles.linkText, { color: palette.neon }]}>Open full image</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={styles.kv}>ID image: not uploaded</Text>
                        )}
                        {detail.verification.selfie_url ? (
                          <View style={styles.imgBox}>
                            <Text style={styles.imgLabel}>Selfie</Text>
                            <Image source={{ uri: detail.verification.selfie_url }} style={styles.img} resizeMode="contain" />
                            <Pressable onPress={() => Linking.openURL(detail.verification.selfie_url)}>
                              <Text style={[styles.linkText, { color: palette.neon }]}>Open full image</Text>
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={styles.kv}>Selfie: not uploaded</Text>
                        )}
                      </>
                    )}
                  </>
                ) : null}

                {/* ============ BADGES ============ */}
                {tab === 'badges' ? (
                  <>
                    <Text style={styles.sectionLabel}>SUBSCRIPTIONS ({(detail.badges || []).length})</Text>
                    {(detail.badges || []).length === 0 ? <Text style={styles.kv}>No badge subscriptions.</Text> :
                      (detail.badges || []).map((b: any, i: number) => {
                        const active = b.expires_at && new Date(b.expires_at) > new Date();
                        return (
                          <View key={i} style={[styles.card2, { borderColor: active ? palette.neon : palette.border }]}>
                            <Text style={[styles.card2Title, { color: active ? palette.neon : palette.text }]}>
                              {(b.badge_tier || '').toUpperCase()} {active ? '· ACTIVE' : '· EXPIRED'}
                            </Text>
                            <Text style={styles.card2Meta}>Subscribed: {fmtDate(b.subscribed_at)}</Text>
                            <Text style={styles.card2Meta}>Expires: {fmtDate(b.expires_at)}</Text>
                            <Text style={styles.card2Meta}>Status: {b.status || '—'}</Text>
                          </View>
                        );
                      })}
                  </>
                ) : null}

                {/* ============ MEMORY ============ */}
                
                {tab === 'memory' ? (
                  <>
                    <Text style={styles.sectionLabel}>WHAT GAIA REMEMBERS</Text>
                    {!detail.memory || (detail.memory || []).length === 0 ? (
                      <Text style={styles.kv}>No memory entries yet.</Text>
                    ) : (
                      (detail.memory || []).map((m: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>{m.key}</Text>
                          <Text style={styles.card2Meta}>{m.value}</Text>
                          <Text style={styles.card2Meta}>Updated {fmtDate(m.updated_at)}</Text>
                        </View>
                      ))
                    )}
                    <Pressable disabled={actionBusy} onPress={() => {
                      Alert.alert('Wipe memory?', 'Deletes every fact GAIA remembers about this user.', [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'WIPE', style: 'destructive', onPress: async () => {
                          setActionBusy(true);
                          const { error } = await supabase.rpc('admin_wipe_memory', { p_user_id: selected.user_id });
                          setActionBusy(false);
                          if (error) Alert.alert('Failed', error.message); else refreshDetail();
                        }},
                      ]);
                    }} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                      <Text style={[styles.actionTxt, { color: palette.warning }]}>WIPE MEMORY</Text>
                    </Pressable>
                  </>
                ) : null}

                {tab === 'support' ? (
                  <>
                    <Text style={styles.sectionLabel}>TICKETS ({(detail.support_tickets || []).length})</Text>
                    {(detail.support_tickets || []).length === 0 ? <Text style={styles.kv}>No tickets.</Text> :
                      (detail.support_tickets || []).map((t: any) => (
                        <View key={t.id} style={styles.card2}>
                          <Text style={styles.card2Title}>{t.subject || '(no subject)'}</Text>
                          <Text style={styles.card2Meta}>Status: {(t.status || 'open').toUpperCase()} · {fmtDate(t.created_at)}</Text>
                          <Text style={styles.msgBody}>{t.message}</Text>
                          {t.attachment_url ? (
                            <Pressable onPress={() => Linking.openURL(t.attachment_url)}>
                              <Text style={[styles.linkText, { color: palette.neon }]}>Open attachment</Text>
                            </Pressable>
                          ) : null}

                          {(t.replies || []).length > 0 ? (
                            <>
                              <Text style={[styles.sectionLabel, { marginTop: 12, fontSize: 10 }]}>REPLIES</Text>
                              {(t.replies || []).map((r: any, j: number) => (
                                <View key={j} style={[styles.replyBox, r.is_admin && styles.replyAdmin]}>
                                  <Text style={styles.replyWho}>{r.is_admin ? 'ADMIN' : 'USER'} · {fmtDate(r.created_at)}</Text>
                                  <Text style={styles.replyBody}>{r.message}</Text>
                                </View>
                              ))}
                            </>
                          ) : null}

                          <TextInput
                            value={replyDraft[t.id] || ''}
                            onChangeText={(v) => setReplyDraft((d) => ({ ...d, [t.id]: v }))}
                            placeholder="Type a reply…"
                            placeholderTextColor={palette.textDim}
                            style={[styles.search, { marginTop: 10 }]}
                            multiline
                          />
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <Pressable disabled={actionBusy} onPress={() => sendSupportReply(t.id)} style={[styles.actionBtn, { flex: 1, marginTop: 0 }]}>
                              <Text style={styles.actionTxt}>SEND REPLY</Text>
                            </Pressable>
                            {t.status !== 'closed' ? (
                              <Pressable disabled={actionBusy} onPress={() => closeSupport(t.id)} style={[styles.actionBtn, { flex: 1, marginTop: 0, borderColor: palette.warning }]}>
                                <Text style={[styles.actionTxt, { color: palette.warning }]}>CLOSE</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      ))}
                  </>
                ) : null}

                {/* ============ PAYMENTS ============ */}
                {tab === 'payments' ? (
                  <>
                    <Text style={styles.sectionLabel}>PAYMENT HISTORY ({(detail.payments || []).length})</Text>
                    {(detail.payments || []).length === 0 ? <Text style={styles.kv}>No payments.</Text> :
                      (detail.payments || []).map((p: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>₦{Number(p.amount || 0).toLocaleString()}</Text>
                          <Text style={styles.card2Meta}>{(p.plan || '').toUpperCase()} · +{p.scans_added || 0} scans</Text>
                          <Text style={styles.card2Meta}>Ref: {(p.reference || '').slice(0, 24)}</Text>
                          <Text style={styles.card2Meta}>{fmtDate(p.paid_at)}</Text>
                        </View>
                      ))}
                  </>
                ) : null}

                {/* ============ CHATS ============ */}
                {tab === 'chats' ? (
                  <>
                    <Text style={styles.sectionLabel}>CHAT SESSIONS ({(detail.sessions || []).length})</Text>
                    {(detail.sessions || []).length === 0 ? <Text style={styles.kv}>No sessions.</Text> :
                      (detail.sessions || []).map((s: any, i: number) => (
                        <View key={i} style={styles.card2}>
                          <Text style={styles.card2Title}>{s.count} messages</Text>
                          <Text style={styles.card2Meta} numberOfLines={3}>{s.preview || '(empty)'}</Text>
                          <Text style={styles.card2Meta}>{fmtDate(s.updated_at)}</Text>
                        </View>
                      ))}
                  </>
                ) : null}

                <Text style={styles.sectionLabel}>SCANS</Text>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, 50)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>+50 SCANS</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, 500)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>+500 SCANS</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => changeScans(selected, -50)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>-50 SCANS</Text>
                </Pressable>

                <Text style={styles.sectionLabel}>WALLET</Text>
                <Pressable disabled={actionBusy} onPress={() => promptWallet(selected, 1000)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>CREDIT ₦1,000</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => promptWallet(selected, 5000)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>CREDIT ₦5,000</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => promptWallet(selected, -1000)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>DEBIT ₦1,000</Text>
                </Pressable>

                <Text style={styles.sectionLabel}>BADGES</Text>
                <Pressable disabled={actionBusy} onPress={() => grantBadge(selected, 'bronze', 30)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>GRANT BRONZE (30d)</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => grantBadge(selected, 'silver', 30)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>GRANT SILVER (30d)</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => grantBadge(selected, 'gold', 30)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>GRANT GOLD (30d)</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => grantBadge(selected, 'platinum', 30)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>GRANT PLATINUM (30d)</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => revokeBadge(selected)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>REVOKE BADGE</Text>
                </Pressable>

                <Text style={styles.sectionLabel}>SAFETY</Text>
                <Pressable disabled={actionBusy} onPress={() => promptBan(selected, 24)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>BAN 24H</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => promptBan(selected, 24*7)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
                  <Text style={[styles.actionTxt, { color: palette.warning }]}>BAN 7D</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => promptBan(selected, 24*30)} style={[styles.actionBtn, { borderColor: palette.danger }]}>
                  <Text style={[styles.actionTxt, { color: palette.danger }]}>BAN 30D</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => promptBan(selected, 999999)} style={[styles.actionBtn, { borderColor: palette.danger }]}>
                  <Text style={[styles.actionTxt, { color: palette.danger }]}>BAN FOREVER</Text>
                </Pressable>
                <Pressable disabled={actionBusy} onPress={() => unban(selected)} style={styles.actionBtn}>
                  <Text style={styles.actionTxt}>UNBAN</Text>
                </Pressable>

                <Text style={styles.sectionLabel}>ACCOUNT</Text>
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
  search: { paddingVertical: 12, paddingHorizontal: 12, color: p.text, fontSize: 14, backgroundColor: p.surface, borderRadius: 10, borderWidth: 1, borderColor: p.border },
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
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, maxHeight: '94%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.neon },
  roleText: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  dmBtn: { padding: 12, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', marginTop: 12 },
  dmText: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  tabBar: { marginTop: 16, marginBottom: 4, maxHeight: 44 },
  tabBarInner: { gap: 6, paddingRight: 8 },
  tabBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  kv: { fontSize: 13, color: p.text, marginBottom: 6, lineHeight: 20 },
  k: { color: p.neon, fontWeight: '700' },
  card2: { padding: 12, borderRadius: 10, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  card2Title: { fontSize: 14, fontWeight: '800', color: p.text },
  card2Meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  msgBody: { fontSize: 12, color: p.text, marginTop: 8, lineHeight: 18 },
  replyBox: { padding: 10, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.03)', marginTop: 6, borderLeftWidth: 2, borderLeftColor: p.textDim },
  replyAdmin: { borderLeftColor: p.neon, backgroundColor: 'rgba(0,255,136,0.05)' },
  replyWho: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
  replyBody: { fontSize: 12, color: p.text, marginTop: 4 },
  imgBox: { marginBottom: 12 },
  imgLabel: { fontSize: 10, fontWeight: '900', color: p.textMuted, letterSpacing: 1, marginBottom: 6 },
  img: { width: '100%', height: 180, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.15)' },
  linkText: { fontSize: 11, fontWeight: '800', marginTop: 6, letterSpacing: 0.5 },
  actionBtn: { padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center', marginTop: 10 },
  actionTxt: { fontSize: 13, fontWeight: '800', color: p.neon, letterSpacing: 1 },
});
