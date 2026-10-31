import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Image, Modal, Linking, RefreshControl, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function AdminMarketplace() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email === 'darkmoorltd@gmail.com';

  const [tab, setTab] = useState<'overview' | 'stores' | 'listings' | 'sellers' | 'buyers' | 'orders' | 'disputes' | 'broadcast'>('overview');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  
  const [viewStore, setViewStore] = useState<any | null>(null);
  const [viewOrder, setViewOrder] = useState<any | null>(null);

  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bTarget, setBTarget] = useState<'sellers'|'buyers'>('sellers');
  const [bSending, setBSending] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [st, s, l, sel, buy, o, d] = await Promise.all([
      supabase.rpc('admin_marketplace_stats'),
      supabase.from('marketplace_stores').select('*').order('created_at', { ascending: false }),
      supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_marketplace_sellers'),
      supabase.rpc('admin_marketplace_buyers'),
      supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.rpc('admin_get_disputes')
    ]);
    
    if (st.data) setStats(st.data);
    if (s.data) setStores(s.data);
    if (l.data) setListings(l.data);
    if (sel.data) setSellers(sel.data);
    if (buy.data) setBuyers(buy.data);
    if (o.data) setOrders(o.data);
    if (d.data) setDisputes(d.data);
    
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const approveStore = async (id: string) => {
    const { error } = await supabase.rpc('admin_approve_store', { p_store_id: id });
    if (error) Alert.alert('Error', error.message);
    else { setViewStore(null); load(); }
  };

  const approveListing = async (id: number) => {
    const { error } = await supabase.rpc('admin_approve_listing', { p_listing_id: id });
    if (error) Alert.alert('Error', error.message); else load();
  };

  const bulkApproveListings = () => {
    const pending = listings.filter(l => l.approval_status === 'pending');
    if (pending.length === 0) return Alert.alert('No pending listings');
    Alert.alert('Approve All?', `Approve all ${pending.length} pending listings?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Approve All', onPress: async () => {
        for (const l of pending) await supabase.rpc('admin_approve_listing', { p_listing_id: l.id });
        load();
      }}
    ]);
  };

  const resolveDispute = async (id: string, action: 'refund'|'release') => {
    Alert.alert('Confirm Action', `Are you sure you want to ${action} this order?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', style: action === 'refund' ? 'destructive' : 'default', onPress: async () => {
        const { error } = await supabase.rpc('admin_resolve_dispute', { p_dispute_id: id, p_action: action });
        if (error) Alert.alert('Error', error.message); else load();
      }}
    ]);
  };

  const sendBroadcast = async () => {
    if (!bTitle.trim() || !bBody.trim()) return Alert.alert('Missing fields');
    setBSending(true);
    try {
      const { error } = await supabase.rpc('admin_broadcast_marketplace', { p_title: bTitle, p_body: bBody, p_target: bTarget });
      if (error) throw error;
      Alert.alert('Sent!', `Push notification sent to all ${bTarget}.`);
      setBTitle(''); setBBody('');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBSending(false); }
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const pendingListingsCount = listings.filter(l => l.approval_status === 'pending').length;
  const pendingStoresCount = stores.filter(s => s.status === 'pending').length;

  const TABS = [
    { id: 'overview', label: '📊 Stats' },
    { id: 'stores', label: '🏪 Stores (' + pendingStoresCount + ')' },
    { id: 'listings', label: '📦 Listings (' + pendingListingsCount + ')' },
    { id: 'sellers', label: '👥 Sellers' },
    { id: 'buyers', label: '🛍️ Buyers' },
    { id: 'orders', label: '🚚 Orders' },
    { id: 'disputes', label: '🛡️ Disputes (' + disputes.length + ')' },
    { id: 'broadcast', label: '📢 Broadcast' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Marketplace God Mode</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {TABS.map(t => (
              <Pressable key={t.id} onPress={() => setTab(t.id as any)} style={[styles.tabBtn, tab === t.id && styles.tabBtnActive]}>
                <Text style={[styles.tabText, tab === t.id && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {/* --- OVERVIEW --- */}
        {tab === 'overview' && stats ? (
          <View style={styles.grid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₦{Number(stats.total_gmv).toLocaleString()}</Text>
              <Text style={styles.statLbl}>TOTAL GMV</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#00ff88' }]}>₦{Number(stats.platform_fees).toLocaleString()}</Text>
              <Text style={styles.statLbl}>PLATFORM FEES (5%)</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{sellers.length}</Text>
              <Text style={styles.statLbl}>TOTAL SELLERS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{buyers.length}</Text>
              <Text style={styles.statLbl}>TOTAL BUYERS</Text>
            </View>
          </View>
        ) : null}

        {/* --- SELLERS --- */}
        {tab === 'sellers' ? (
          sellers.map(sel => (
            <View key={sel.user_id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{sel.store_name}</Text>
                <Text style={[styles.statusChip, { color: '#00ff88', borderColor: '#00ff88' }]}>{sel.store_type.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>👤 {sel.name} · {sel.email}</Text>
              <Text style={styles.cardMeta}>📞 {sel.phone || 'No phone'}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={[styles.cardMeta, { color: '#00ff88', fontWeight: 'bold' }]}>GMV: ₦{Number(sel.total_sales).toLocaleString()}</Text>
                <Text style={styles.cardMeta}>{sel.order_count} orders</Text>
              </View>
            </View>
          ))
        ) : null}

        {/* --- BUYERS --- */}
        {tab === 'buyers' ? (
          buyers.map(b => (
            <View key={b.user_id} style={styles.card}>
              <Text style={styles.cardTitle}>{b.name}</Text>
              <Text style={styles.cardMeta}>✉️ {b.email}</Text>
              <Text style={styles.cardMeta}>📞 {b.phone || 'No phone'}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' }}>
                <Text style={[styles.cardMeta, { color: '#ffb300', fontWeight: 'bold' }]}>Total Spent: ₦{Number(b.total_spend).toLocaleString()}</Text>
                <Text style={styles.cardMeta}>{b.order_count} purchases</Text>
              </View>
            </View>
          ))
        ) : null}

        {/* --- ORDERS --- */}
        {tab === 'orders' ? (
          orders.map(o => (
            <Pressable key={o.id} onPress={() => setViewOrder(o)} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{o.listing_title}</Text>
                <Text style={styles.statusChip}>{o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(o.total).toLocaleString()} · Qty {o.quantity}</Text>
              <Text style={styles.cardMeta}>Ref: {o.order_ref}</Text>
              <Text style={[styles.cardMeta, { color: palette.neon, marginTop: 4 }]}>Tap for full details →</Text>
            </Pressable>
          ))
        ) : null}

        {/* --- STORES --- */}
        {tab === 'stores' ? (
          stores.map(s => (
            <Pressable key={s.id} onPress={() => setViewStore(s)} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{s.store_name}</Text>
                <Text style={[styles.statusChip, s.status === 'active' ? { color: '#00ff88', borderColor: '#00ff88' } : { color: '#ffb300', borderColor: '#ffb300' }]}>
                  {s.status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.cardMeta}>{s.store_type.toUpperCase()} · {s.billing_cycle}</Text>
              <Text style={[styles.cardMeta, { color: palette.neon, marginTop: 8 }]}>Tap to view images & docs →</Text>
            </Pressable>
          ))
        ) : null}

        {/* --- LISTINGS --- */}
        {tab === 'listings' ? (
          <>
            {pendingListingsCount > 0 ? (
              <Pressable onPress={bulkApproveListings} style={[styles.btn, { backgroundColor: '#00ff88', marginBottom: 16 }]}>
                <Text style={{ fontWeight: '900', color: '#000' }}>⚡ BULK APPROVE ALL ({pendingListingsCount})</Text>
              </Pressable>
            ) : null}
            {listings.map(l => (
              <View key={l.id} style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.cardTitle}>{l.title}</Text>
                  <Text style={[styles.statusChip, l.approval_status === 'approved' ? { color: '#00ff88', borderColor: '#00ff88' } : { color: '#ffb300', borderColor: '#ffb300' }]}>
                    {l.approval_status.toUpperCase()}
                  </Text>
                </View>
                <Text style={styles.cardMeta}>₦{Number(l.price).toLocaleString()} · Qty: {l.quantity} {l.unit}</Text>
                {l.approval_status === 'pending' ? (
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                    <Pressable onPress={() => approveListing(l.id)} style={[styles.smallBtn, { backgroundColor: '#00ff88' }]}>
                      <Text style={{ fontWeight: '900', color: '#000', fontSize: 11 }}>APPROVE</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ))}
          </>
        ) : null}

        {/* --- DISPUTES --- */}
        {tab === 'disputes' ? (
          disputes.length === 0 ? <Text style={styles.cardMeta}>No open disputes. 🎉</Text> :
          disputes.map(d => (
            <View key={d.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>Order #{d.order_id}</Text>
                <Text style={[styles.statusChip, { color: '#ff3b5c', borderColor: '#ff3b5c' }]}>DISPUTED</Text>
              </View>
              <Text style={styles.cardMeta}>Total: ₦{Number(d.order_total).toLocaleString()}</Text>
              <Text style={styles.cardMeta}>Reason: <Text style={{ color: '#fff' }}>{d.reason}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={() => resolveDispute(d.id, 'refund')} style={[styles.smallBtn, { backgroundColor: '#ff3b5c' }]}>
                  <Text style={{ fontWeight: '900', color: '#fff', fontSize: 11 }}>REFUND BUYER</Text>
                </Pressable>
                <Pressable onPress={() => resolveDispute(d.id, 'release')} style={[styles.smallBtn, { backgroundColor: '#00ff88' }]}>
                  <Text style={{ fontWeight: '900', color: '#000', fontSize: 11 }}>PAY SELLER</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}

        {/* --- BROADCAST --- */}
        {tab === 'broadcast' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Send Push Notification</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 10 }}>
              <Pressable onPress={() => setBTarget('sellers')} style={[styles.smallBtn, bTarget === 'sellers' && { backgroundColor: '#00ff88' }]}>
                <Text style={{ fontWeight: '900', color: bTarget === 'sellers' ? '#000' : '#fff' }}>SELLERS</Text>
              </Pressable>
              <Pressable onPress={() => setBTarget('buyers')} style={[styles.smallBtn, bTarget === 'buyers' && { backgroundColor: '#00ff88' }]}>
                <Text style={{ fontWeight: '900', color: bTarget === 'buyers' ? '#000' : '#fff' }}>BUYERS</Text>
              </Pressable>
            </View>
            <TextInput value={bTitle} onChangeText={setBTitle} placeholder="Title" placeholderTextColor="#888" style={styles.input} />
            <TextInput value={bBody} onChangeText={setBBody} placeholder="Message body..." placeholderTextColor="#888" style={[styles.input, { height: 80, textAlignVertical: 'top' }]} multiline />
            <Pressable onPress={sendBroadcast} disabled={bSending} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 16 }]}>
              {bSending ? <ActivityIndicator color="#000" /> : <Text style={{ fontWeight: '900', color: '#000' }}>SEND BROADCAST</Text>}
            </Pressable>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* --- STORE VIEW MODAL --- */}
      <Modal visible={!!viewStore} transparent animationType="slide" onRequestClose={() => setViewStore(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewStore(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{viewStore?.store_name}</Text>
            <Text style={styles.cardMeta}>{viewStore?.store_type.toUpperCase()} · {viewStore?.status.toUpperCase()}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {viewStore?.images?.length > 0 ? viewStore.images.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                )) : <Text style={styles.cardMeta}>No images.</Text>}
              </View>
            </ScrollView>
            {viewStore?.status === 'pending' ? (
              <Pressable onPress={() => approveStore(viewStore.id)} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 20 }]}>
                <Text style={{ fontWeight: '900', color: '#000' }}>APPROVE STORE</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* --- ORDER VIEW MODAL --- */}
      <Modal visible={!!viewOrder} transparent animationType="slide" onRequestClose={() => setViewOrder(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewOrder(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>Order Details</Text>
            <Text style={styles.cardTitle}>{viewOrder?.listing_title}</Text>
            
            <Text style={styles.section}>BUYER INFO</Text>
            <Text style={styles.cardMeta}>Name: {viewOrder?.buyer_name}</Text>
            <Text style={styles.cardMeta}>Phone: {viewOrder?.buyer_phone}</Text>
            <Text style={styles.cardMeta}>Address: {viewOrder?.delivery_address}</Text>
            <Text style={styles.cardMeta}>Method: {viewOrder?.delivery_method}</Text>

            <Text style={styles.section}>PAYMENT & STATUS</Text>
            <Text style={styles.cardMeta}>Total: ₦{Number(viewOrder?.total).toLocaleString()}</Text>
            <Text style={styles.cardMeta}>Status: {viewOrder?.status?.toUpperCase()}</Text>
            <Text style={styles.cardMeta}>Ref: {viewOrder?.order_ref}</Text>
            <Text style={styles.cardMeta}>Date: {new Date(viewOrder?.created_at).toLocaleString()}</Text>
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
  
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)', borderColor: p.neon },
  tabText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  tabTextActive: { color: p.neon },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { width: '48%', padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 22, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 8, letterSpacing: 1 },

  card: { padding: 16, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: p.text, flex: 1 },
  cardMeta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  statusChip: { fontSize: 9, fontWeight: '900', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, color: p.textMuted, borderColor: p.border, overflow: 'hidden' },
  
  smallBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border, color: p.text, marginBottom: 10 },
  
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginTop: 20, marginBottom: 8 },
});
