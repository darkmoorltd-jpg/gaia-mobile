import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Modal, TextInput, RefreshControl, Image, Linking, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const { width } = Dimensions.get('window');

export default function AdminMarketplace() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email === 'darkmoorltd@gmail.com';

  const [tab, setTab] = useState<any>('overview');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [search, setSearch] = useState('');

  // Data states
  const [stats, setStats] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [topSellers, setTopSellers] = useState<any[]>([]);
  
  // Modals
  const [viewStore, setViewStore] = useState<any | null>(null);
  const [viewListing, setViewListing] = useState<any | null>(null);

  // Settings
  const [config, setConfig] = useState<any>(null);
  const [deliveryFee, setDeliveryFee] = useState('2500');
  const [commFee, setCommFee] = useState('5');
  const [boostFee, setBoostFee] = useState('1000');
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const safeCall = async (fn: any) => { try { const r = await fn(); return r.data || []; } catch { return []; } };
    const safeObj = async (fn: any) => { try { const r = await fn(); return r.data || {}; } catch { return {}; } };

    const st = await safeObj(() => supabase.rpc('admin_marketplace_stats'));
    const ch = await safeCall(() => supabase.rpc('admin_marketplace_chart'));
    const s = await safeCall(() => supabase.from('marketplace_stores').select('*').order('created_at', { ascending: false }));
    const l = await safeCall(() => supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false }));
    const o = await safeCall(() => supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }).limit(100));
    const d = await safeCall(() => supabase.rpc('admin_get_disputes'));
    const p = await safeCall(() => supabase.rpc('admin_get_withdrawals'));
    const e = await safeCall(() => supabase.rpc('admin_get_expiring_stores'));
    const cfg = await safeObj(() => supabase.from('marketplace_config').select('*').eq('id', 1).single());
    const ts = await safeCall(() => supabase.rpc('admin_top_sellers'));
    const ts = await safeCall(() => supabase.rpc('admin_top_sellers'));
    
    setStats(st);
    setChart(ch);
    setStores(s);
    setListings(l);
    setOrders(o);
    setDisputes(d);
    setPayouts(p);
    setExpiring(e);
    if (cfg) {
      setConfig(cfg);
      setDeliveryFee(String(cfg.delivery_fee));
      setCommFee(String(cfg.commission_pct));
      setBoostFee(String(cfg.boost_fee));
    }
    setTopSellers(ts);
    setTopSellers(ts);
    
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  // Actions
  const approveStore = async (id: string) => {
    const { error } = await supabase.rpc('admin_approve_store', { p_store_id: id });
    if (error) Alert.alert('Error', error.message); else { Alert.alert('Success', 'Store is now active.'); setViewStore(null); load(); }
  };
  const approveListing = async (id: number) => {
    const { error } = await supabase.rpc('admin_approve_listing', { p_listing_id: id });
    if (error) Alert.alert('Error', error.message); else { Alert.alert('Success', 'Listing is live.'); setViewListing(null); load(); }
  };
  const settlePayout = async (id: string, status: 'paid'|'rejected') => {
    await supabase.rpc('admin_settle_withdrawal', { p_id: id, p_status: status });
    load();
  };
  const saveConfig = async () => {
    await supabase.from('marketplace_config').update({
      delivery_fee: Number(deliveryFee),
      commission_pct: Number(commFee),
      boost_fee: Number(boostFee),
    }).eq('id', 1);
    Alert.alert('Saved', 'Financial settings updated successfully.');
    load();
  };
  const sendBroadcast = async () => {
    if (!bTitle.trim() || !bBody.trim()) return;
    await supabase.rpc('admin_broadcast_marketplace', { p_title: bTitle, p_body: bBody, p_target: 'sellers' });
    Alert.alert('Sent!'); setBTitle(''); setBBody('');
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const TABS = [
    { id: 'overview', label: '📊 Stats' },
    { id: 'stores', label: '🏪 Stores (' + stores.filter((x:any)=>x.status==='pending').length + ')' },
    { id: 'listings', label: '📦 Listings (' + listings.filter((x:any)=>x.approval_status==='pending').length + ')' },
    { id: 'orders', label: '🚚 Orders' },
    { id: 'disputes', label: '🛡️ Disputes (' + disputes.length + ')' },
    { id: 'payouts', label: '💸 Payouts (' + payouts.filter((x:any)=>x.status==='pending').length + ')' },
    { id: 'expiring', label: '⏳ Expiring' },
    { id: 'broadcast', label: '📢 Broadcast' },
    { id: 'settings', label: '⚙️ Financials' },
  ];

  const filterData = (data: any[], key: string) => {
    if (!search.trim()) return data;
    return data.filter((d: any) => d[key]?.toLowerCase().includes(search.toLowerCase()) || d.id?.toString().includes(search));
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['rgba(0,255,136,0.1)', 'transparent']} style={styles.headerGradient}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Marketplace <Text style={{color: '#00ff88'}}>God Mode</Text></Text>
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search stores, listings, orders..." placeholderTextColor="rgba(255,255,255,0.4)" style={styles.searchInput} />
        </View>
      </LinearGradient>

      <View style={styles.tabContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}>
          {TABS.map(t => (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tabBtn, tab === t.id && styles.tabActive]}>
              <Text style={[styles.tabTxt, tab === t.id && { color: '#000' }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#00ff88" />}>
        {busy ? <ActivityIndicator color="#00ff88" style={{ marginTop: 40 }} /> : null}

        {/* --- OVERVIEW --- */}
        {tab === 'overview' && stats ? (
          <View>
            <View style={styles.grid}>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>₦{Number(stats.total_gmv || 0).toLocaleString()}</Text>
                <Text style={styles.statLbl}>TOTAL GMV</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statVal, { color: '#00ff88' }]}>₦{Number(stats.platform_fees || 0).toLocaleString()}</Text>
                <Text style={styles.statLbl}>REVENUE (5%)</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{stats.active_stores || 0}</Text>
                <Text style={styles.statLbl}>ACTIVE STORES</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statVal}>{orders.length}</Text>
                <Text style={styles.statLbl}>RECENT ORDERS</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 Top Sellers Leaderboard</Text>
              {topSellers.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888', marginRight: 12 }}>#{i+1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{s.store_name || s.email?.split('@')[0]}</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>{s.order_count} orders</Text>
                  </View>
                  <Text style={{ color: '#00ff88', fontWeight: '900' }}>₦{Number(s.revenue).toLocaleString()}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 Top Sellers Leaderboard</Text>
              {topSellers.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' }}>
                  <Text style={{ fontSize: 18, fontWeight: '900', color: i === 0 ? '#ffd700' : i === 1 ? '#c0c0c0' : i === 2 ? '#cd7f32' : '#888', marginRight: 12 }}>#{i+1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{s.store_name || s.email?.split('@')[0]}</Text>
                    <Text style={{ color: '#888', fontSize: 11 }}>{s.order_count} orders</Text>
                  </View>
                  <Text style={{ color: '#00ff88', fontWeight: '900' }}>₦{Number(s.revenue).toLocaleString()}</Text>
                </View>
              ))}
            </View>
            
            <View style={styles.card}>
              <Text style={styles.cardTitle}>7-Day Revenue</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, marginTop: 20, gap: 8 }}>
                {chart.length === 0 ? <Text style={{color:'#888'}}>No revenue yet.</Text> : chart.map((c, i) => {
                  const max = Math.max(...chart.map((x:any) => x.total)) || 1;
                  return (
                    <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                      <View style={{ width: '100%', backgroundColor: '#00ff88', height: `${(c.total / max) * 100}%`, borderRadius: 4 }} />
                      <Text style={{ fontSize: 9, color: '#888', marginTop: 4 }}>{c.day}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {/* --- STORES --- */}
        {tab === 'stores' ? (
          filterData(stores, 'store_name').map(s => (
            <Pressable key={s.id} onPress={() => setViewStore(s)} style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.cardTitle}>{s.store_name}</Text>
                <Text style={[styles.statusChip, { color: s.status === 'active' ? '#00ff88' : '#ffb300', borderColor: s.status === 'active' ? '#00ff88' : '#ffb300' }]}>{s.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>Type: {s.store_type.toUpperCase()} · {s.billing_cycle}</Text>
              <Text style={styles.cardMeta}>📍 {s.location || 'No location'}</Text>
              <Text style={[styles.cardMeta, { color: '#00ff88', marginTop: 10 }]}>Tap to view images, documents, and approve →</Text>
            </Pressable>
          ))
        ) : null}

        {/* --- LISTINGS --- */}
        {tab === 'listings' ? (
          filterData(listings, 'title').map(l => (
            <Pressable key={l.id} onPress={() => setViewListing(l)} style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                <Text style={[styles.statusChip, { color: l.approval_status === 'approved' ? '#00ff88' : '#ffb300', borderColor: l.approval_status === 'approved' ? '#00ff88' : '#ffb300' }]}>{l.approval_status?.toUpperCase() || 'PENDING'}</Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(l.price).toLocaleString()} · Qty: {l.quantity} {l.unit}</Text>
              <Text style={styles.cardMeta}>Seller ID: {l.seller_id.slice(0, 8)}</Text>
            </Pressable>
          ))
        ) : null}

        {/* --- ORDERS --- */}
        {tab === 'orders' ? (
          filterData(orders, 'listing_title').map(o => (
            <View key={o.id} style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.cardTitle}>{o.listing_title}</Text>
                <Text style={styles.statusChip}>{o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(o.total).toLocaleString()} · Qty: {o.quantity}</Text>
              <Text style={styles.cardMeta}>Buyer: {o.buyer_name || o.buyer_phone}</Text>
              <Text style={styles.cardMeta}>Ref: {o.order_ref}</Text>
            </View>
          ))
        ) : null}

        {/* --- PAYOUTS --- */}
        {tab === 'payouts' ? (
          payouts.map(p => (
            <View key={p.id} style={styles.card}>
              <View style={{flexDirection:'row', justifyContent:'space-between'}}>
                <Text style={styles.cardTitle}>₦{Number(p.amount).toLocaleString()}</Text>
                <Text style={[styles.statusChip, { color: p.status === 'pending' ? '#ffb300' : '#00ff88', borderColor: p.status === 'pending' ? '#ffb300' : '#00ff88' }]}>{p.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>Seller: {p.email}</Text>
              {p.status === 'pending' ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                  <Pressable onPress={() => settlePayout(p.id, 'paid')} style={[styles.btn, { backgroundColor: '#00ff88', flex: 1 }]}><Text style={{ fontWeight: '900', color: '#000' }}>MARK PAID</Text></Pressable>
                  <Pressable onPress={() => settlePayout(p.id, 'rejected')} style={[styles.btn, { borderWidth: 1, borderColor: '#ff3b5c', flex: 1 }]}><Text style={{ fontWeight: '900', color: '#ff3b5c' }}>REJECT</Text></Pressable>
                </View>
              ) : null}
            </View>
          ))
        ) : null}

        {/* --- DISPUTES --- */}
        {tab === 'disputes' ? (
          disputes.map(d => (
            <View key={d.id} style={[styles.card, { borderColor: '#ff3b5c' }]}>
              <Text style={[styles.cardTitle, { color: '#ff3b5c' }]}>Order #{d.order_id.slice(0,8)} Dispute</Text>
              <Text style={styles.cardMeta}>Reason: {d.reason}</Text>
              <Text style={styles.cardMeta}>Raised by: {d.raised_by.slice(0,8)}</Text>
              <Pressable onPress={() => router.push({ pathname: '/escrow-chat', params: { order_id: String(d.order_id) } } as any)} style={[styles.btn, { backgroundColor: '#ff3b5c', marginTop: 12 }]}>
                <Text style={{ fontWeight: '900', color: '#fff' }}>OPEN DISPUTE CHAT</Text>
              </Pressable>
            </View>
          ))
        ) : null}

        {/* --- BROADCAST --- */}
        {tab === 'broadcast' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Broadcast to Sellers</Text>
            <TextInput value={bTitle} onChangeText={setBTitle} placeholder="Title" placeholderTextColor="#888" style={styles.input} />
            <TextInput value={bBody} onChangeText={setBBody} placeholder="Message" placeholderTextColor="#888" style={[styles.input, { height: 80 }]} multiline />
            <Pressable onPress={sendBroadcast} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 12 }]}><Text style={{ fontWeight: '900', color: '#000' }}>SEND PUSH</Text></Pressable>
          </View>
        ) : null}

        {/* --- SETTINGS --- */}
        {tab === 'settings' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Financial Engine</Text>
            
            <Text style={{ color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 }}>Platform Commission (%)</Text>
            <TextInput value={commFee} onChangeText={setCommFee} keyboardType="numeric" style={styles.input} />
            
            <Text style={{ color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 }}>Boost Fee (₦)</Text>
            <TextInput value={boostFee} onChangeText={setBoostFee} keyboardType="numeric" style={styles.input} />
            
            <Text style={{ color: '#888', fontSize: 12, marginTop: 12, marginBottom: 4 }}>Global Delivery Fee (₦)</Text>
            <TextInput value={deliveryFee} onChangeText={setDeliveryFee} keyboardType="numeric" style={styles.input} />
            
            <Pressable onPress={saveConfig} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 20 }]}><Text style={{ fontWeight: '900', color: '#000' }}>SAVE CHANGES</Text></Pressable>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* --- STORE VIEWER MODAL --- */}
      <Modal visible={!!viewStore} transparent animationType="slide" onRequestClose={() => setViewStore(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewStore(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>{viewStore?.store_name}</Text>
            <Text style={styles.cardMeta}>{viewStore?.store_type.toUpperCase()} · {viewStore?.location}</Text>

            <Text style={styles.section}>STORE IMAGES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {viewStore?.images?.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 140, height: 140, borderRadius: 10, backgroundColor: '#222' }} />
                ))}
                {(!viewStore?.images || viewStore.images.length === 0) ? <Text style={{color:'#888'}}>No images</Text> : null}
              </View>
            </ScrollView>

            <Text style={styles.section}>DOCUMENTS</Text>
            {viewStore?.documents?.map((doc: string, i: number) => (
              <Pressable key={i} onPress={() => Linking.openURL(doc)} style={styles.docLink}>
                <Text style={{ color: '#00ff88', fontWeight: 'bold' }}>📄 Open Document {i+1}</Text>
              </Pressable>
            ))}
            {(!viewStore?.documents || viewStore.documents.length === 0) ? <Text style={{color:'#888'}}>No documents</Text> : null}

            {viewStore?.status === 'pending' ? (
              <Pressable onPress={() => approveStore(viewStore.id)} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 20 }]}>
                <Text style={{ fontWeight: '900', color: '#000', fontSize: 16 }}>APPROVE STORE</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* --- LISTING VIEWER MODAL --- */}
      <Modal visible={!!viewListing} transparent animationType="slide" onRequestClose={() => setViewListing(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewListing(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.modalTitle}>{viewListing?.title}</Text>
            <Text style={styles.cardMeta}>₦{Number(viewListing?.price).toLocaleString()} per {viewListing?.unit}</Text>
            <Text style={styles.cardMeta}>Qty: {viewListing?.quantity} · Category: {viewListing?.category}</Text>
            
            <Text style={styles.section}>DESCRIPTION</Text>
            <Text style={{ color: '#ccc', fontSize: 14, lineHeight: 20 }}>{viewListing?.description || 'No description provided.'}</Text>

            <Text style={styles.section}>IMAGES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {viewListing?.images?.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 140, height: 140, borderRadius: 10, backgroundColor: '#222' }} />
                ))}
              </View>
            </ScrollView>

            {viewListing?.approval_status === 'pending' ? (
              <Pressable onPress={() => approveListing(viewListing.id)} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 20 }]}>
                <Text style={{ fontWeight: '900', color: '#000', fontSize: 16 }}>APPROVE LISTING</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  headerGradient: { paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#00ff88', marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1, marginBottom: 16 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 12, paddingHorizontal: 14 },
  searchIcon: { fontSize: 16, marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 14, color: '#fff', fontSize: 14 },
  tabContainer: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)', paddingBottom: 12 },
  tabBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.05)' },
  tabActive: { backgroundColor: '#00ff88' },
  tabTxt: { fontSize: 11, fontWeight: '800', color: '#aaa' },
  scroll: { padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  statBox: { width: '48%', padding: 20, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.15)' },
  statVal: { fontSize: 22, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 9, fontWeight: '800', color: '#888', marginTop: 8, letterSpacing: 1 },
  card: { padding: 16, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.03)', marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#fff', flex: 1 },
  cardMeta: { fontSize: 12, color: '#888', marginTop: 6 },
  statusChip: { fontSize: 9, fontWeight: '900', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, overflow: 'hidden' },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  input: { padding: 14, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', color: '#fff', marginTop: 12 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: '#ff3b5c' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: '#00ff88', marginTop: 24, marginBottom: 12 },
  docLink: { padding: 14, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 10, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
});
