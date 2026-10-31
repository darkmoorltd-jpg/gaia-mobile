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

  const [tab, setTab] = useState<'overview' | 'stores' | 'listings' | 'sellers' | 'buyers' | 'orders' | 'disputes' | 'broadcast' | 'settings'>('overview');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  
  const [viewStore, setViewStore] = useState<any | null>(null);
  const [viewOrder, setViewOrder] = useState<any | null>(null);

  // Settings form
  const [commission, setCommission] = useState('5');
  const [small, setSmall] = useState('2500');
  const [medium, setMedium] = useState('5000');
  const [large, setLarge] = useState('10000');
  const [commercial, setCommercial] = useState('25000');
  const [featured, setFeatured] = useState('5000');

  // Broadcast form
  const [bTitle, setBTitle] = useState('');
  const [bBody, setBBody] = useState('');
  const [bTarget, setBTarget] = useState<'sellers'|'buyers'>('sellers');
  const [bSending, setBSending] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [st, s, l, sel, buy, o, d, cfg] = await Promise.all([
      supabase.rpc('admin_marketplace_stats'),
      supabase.from('marketplace_stores').select('*').order('created_at', { ascending: false }),
      supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false }),
      supabase.rpc('admin_marketplace_sellers'),
      supabase.rpc('admin_marketplace_buyers'),
      supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.rpc('admin_get_disputes'),
      supabase.from('marketplace_settings').select('*').eq('id', 1).single()
    ]);
    
    if (st.data) setStats(st.data);
    if (s.data) setStores(s.data);
    if (l.data) setListings(l.data);
    if (sel.data) setSellers(sel.data);
    if (buy.data) setBuyers(buy.data);
    if (o.data) setOrders(o.data);
    if (d.data) setDisputes(d.data);
    if (cfg.data) {
      setSettings(cfg.data);
      setCommission(String(cfg.data.commission_rate * 100));
      setSmall(String(cfg.data.small_price));
      setMedium(String(cfg.data.medium_price));
      setLarge(String(cfg.data.large_price));
      setCommercial(String(cfg.data.commercial_price));
      setFeatured(String(cfg.data.featured_price));
    }
    
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const approveStore = async (id: string) => {
    await supabase.rpc('admin_approve_store', { p_store_id: id });
    setViewStore(null); load();
  };

  const banUser = (uid: string, name: string) => {
    Alert.alert('Ban User?', `Ban ${name} from the marketplace? This will hide their store and listings.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'BAN', style: 'destructive', onPress: async () => {
        await supabase.rpc('admin_ban_user_marketplace', { p_user_id: uid, p_ban: true });
        load();
      }}
    ]);
  };

  const saveSettings = async () => {
    try {
      await supabase.rpc('admin_update_marketplace_settings', {
        p_commission: Number(commission) / 100,
        p_small: Number(small),
        p_medium: Number(medium),
        p_large: Number(large),
        p_commercial: Number(commercial),
        p_featured: Number(featured),
      });
      Alert.alert('Saved', 'Platform economics updated.');
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const resolveDispute = async (id: string, action: 'refund'|'release') => {
    await supabase.rpc('admin_resolve_dispute', { p_dispute_id: id, p_action: action });
    load();
  };

  const sendBroadcast = async () => {
    if (!bTitle.trim() || !bBody.trim()) return Alert.alert('Missing fields');
    setBSending(true);
    try {
      await supabase.rpc('admin_broadcast_marketplace', { p_title: bTitle, p_body: bBody, p_target: bTarget });
      Alert.alert('Sent!', `Notification sent to all ${bTarget}.`);
      setBTitle(''); setBBody('');
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setBSending(false); }
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const TABS = ['overview', 'stores', 'listings', 'sellers', 'buyers', 'orders', 'disputes', 'broadcast', 'settings'];

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
              <Pressable key={t} onPress={() => setTab(t as any)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
                <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>{t.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {/* --- SELLERS --- */}
        {tab === 'sellers' ? (
          sellers.map(sel => (
            <View key={sel.user_id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{sel.store_name}</Text>
                <Pressable onPress={() => banUser(sel.user_id, sel.name)} style={{ padding: 4, backgroundColor: 'rgba(255,59,92,0.2)', borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: '#ff3b5c', fontWeight: '900' }}>BAN</Text>
                </Pressable>
              </View>
              <Text style={styles.cardMeta}>👤 {sel.name} · {sel.email}</Text>
              <Text style={styles.cardMeta}>📞 {sel.phone || 'No phone'}</Text>
              <Text style={[styles.cardMeta, { color: '#00ff88', marginTop: 8 }]}>GMV: ₦{Number(sel.total_sales).toLocaleString()} ({sel.order_count} orders)</Text>
            </View>
          ))
        ) : null}

        {/* --- BUYERS --- */}
        {tab === 'buyers' ? (
          buyers.map(b => (
            <View key={b.user_id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{b.name}</Text>
                <Pressable onPress={() => banUser(b.user_id, b.name)} style={{ padding: 4, backgroundColor: 'rgba(255,59,92,0.2)', borderRadius: 4 }}>
                  <Text style={{ fontSize: 10, color: '#ff3b5c', fontWeight: '900' }}>BAN</Text>
                </Pressable>
              </View>
              <Text style={styles.cardMeta}>✉️ {b.email}</Text>
              <Text style={[styles.cardMeta, { color: '#ffb300', marginTop: 8 }]}>Spent: ₦{Number(b.total_spend).toLocaleString()} ({b.order_count} purchases)</Text>
            </View>
          ))
        ) : null}

        {/* --- SETTINGS --- */}
        {tab === 'settings' && settings ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Platform Economics</Text>
            <Text style={styles.cardMeta}>Update the commission and pricing in real-time.</Text>
            
            <Text style={styles.label}>COMMISSION RATE (%)</Text>
            <TextInput value={commission} onChangeText={setCommission} keyboardType="numeric" style={styles.input} />

            <Text style={styles.label}>SMALL STORE (₦)</Text>
            <TextInput value={small} onChangeText={setSmall} keyboardType="numeric" style={styles.input} />

            <Text style={styles.label}>MEDIUM STORE (₦)</Text>
            <TextInput value={medium} onChangeText={setMedium} keyboardType="numeric" style={styles.input} />

            <Text style={styles.label}>LARGE STORE (₦)</Text>
            <TextInput value={large} onChangeText={setLarge} keyboardType="numeric" style={styles.input} />

            <Text style={styles.label}>COMMERCIAL STORE (₦)</Text>
            <TextInput value={commercial} onChangeText={setCommercial} keyboardType="numeric" style={styles.input} />

            <Text style={styles.label}>FEATURED LISTING BOOST (₦)</Text>
            <TextInput value={featured} onChangeText={setFeatured} keyboardType="numeric" style={styles.input} />

            <Pressable onPress={saveSettings} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 16 }]}>
              <Text style={{ fontWeight: '900', color: '#000' }}>SAVE SETTINGS</Text>
            </Pressable>
          </View>
        ) : null}

        {/* --- PREVIOUS TABS (Stores, Listings, Orders, Disputes, Broadcast) --- */}
        {tab === 'stores' ? (
          stores.map(s => (
            <Pressable key={s.id} onPress={() => setViewStore(s)} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{s.store_name}</Text>
                <Text style={styles.statusChip}>{s.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>{s.store_type.toUpperCase()} · {s.billing_cycle}</Text>
            </Pressable>
          ))
        ) : null}

        {tab === 'listings' ? (
          listings.map(l => (
            <View key={l.id} style={styles.card}>
              <Text style={styles.cardTitle}>{l.title}</Text>
              <Text style={styles.cardMeta}>₦{Number(l.price).toLocaleString()} · {l.approval_status.toUpperCase()}</Text>
              {l.approval_status === 'pending' ? (
                <Pressable onPress={() => supabase.rpc('admin_approve_listing', { p_listing_id: l.id }).then(load)} style={[styles.smallBtn, { backgroundColor: '#00ff88', marginTop: 8 }]}>
                  <Text style={{ fontWeight: '900', color: '#000' }}>APPROVE</Text>
                </Pressable>
              ) : null}
            </View>
          ))
        ) : null}

        {tab === 'orders' ? (
          orders.map(o => (
            <Pressable key={o.id} onPress={() => setViewOrder(o)} style={styles.card}>
              <Text style={styles.cardTitle}>{o.listing_title}</Text>
              <Text style={styles.cardMeta}>₦{Number(o.total).toLocaleString()} · {o.status}</Text>
            </Pressable>
          ))
        ) : null}

        {tab === 'disputes' ? (
          disputes.map(d => (
            <View key={d.id} style={styles.card}>
              <Text style={styles.cardTitle}>Order #{d.order_id}</Text>
              <Text style={styles.cardMeta}>Reason: {d.reason}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <Pressable onPress={() => resolveDispute(d.id, 'refund')} style={[styles.smallBtn, { backgroundColor: '#ff3b5c' }]}>
                  <Text style={{ fontWeight: '900', color: '#fff' }}>REFUND</Text>
                </Pressable>
                <Pressable onPress={() => resolveDispute(d.id, 'release')} style={[styles.smallBtn, { backgroundColor: '#00ff88' }]}>
                  <Text style={{ fontWeight: '900', color: '#000' }}>PAY SELLER</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : null}

        {tab === 'broadcast' ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Broadcast Push Notification</Text>
            <TextInput value={bTitle} onChangeText={setBTitle} placeholder="Title" style={styles.input} />
            <TextInput value={bBody} onChangeText={setBBody} placeholder="Message" style={[styles.input, { height: 80 }]} multiline />
            <Pressable onPress={sendBroadcast} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 16 }]}>
              <Text style={{ fontWeight: '900', color: '#000' }}>SEND</Text>
            </Pressable>
          </View>
        ) : null}

        {tab === 'overview' && stats ? (
          <View style={styles.grid}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₦{Number(stats.total_gmv).toLocaleString()}</Text>
              <Text style={styles.statLbl}>GMV</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#00ff88' }]}>₦{Number(stats.platform_fees).toLocaleString()}</Text>
              <Text style={styles.statLbl}>FEES</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* --- STORE MODAL --- */}
      <Modal visible={!!viewStore} transparent animationType="slide" onRequestClose={() => setViewStore(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewStore(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{viewStore?.store_name}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {viewStore?.images?.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                ))}
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

      {/* --- ORDER MODAL --- */}
      <Modal visible={!!viewOrder} transparent animationType="slide" onRequestClose={() => setViewOrder(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewOrder(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>Order Details</Text>
            <Text style={styles.cardMeta}>Buyer: {viewOrder?.buyer_name}</Text>
            <Text style={styles.cardMeta}>Phone: {viewOrder?.buyer_phone}</Text>
            <Text style={styles.cardMeta}>Address: {viewOrder?.delivery_address}</Text>
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
  tabText: { fontSize: 10, fontWeight: '700', color: p.textMuted },
  tabTextActive: { color: p.neon },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: { width: '48%', padding: 20, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 22, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 8, letterSpacing: 1 },
  card: { padding: 16, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 16, fontWeight: '800', color: p.text, flex: 1 },
  cardMeta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  statusChip: { fontSize: 9, fontWeight: '900', borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, color: p.textMuted, borderColor: p.border },
  smallBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  btn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.obsidian, borderWidth: 1, borderColor: p.border, color: p.text, marginBottom: 10 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
});
