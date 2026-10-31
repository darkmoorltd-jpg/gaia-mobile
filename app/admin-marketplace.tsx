import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Image, Modal, Linking, RefreshControl } from 'react-native';
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

  const [tab, setTab] = useState<'overview' | 'stores' | 'listings' | 'orders'>('overview');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const [stats, setStats] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  
  const [viewStore, setViewStore] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [st, s, l, o] = await Promise.all([
      supabase.rpc('admin_marketplace_stats'),
      supabase.from('marketplace_stores').select('*').order('created_at', { ascending: false }),
      supabase.from('marketplace_listings').select('*').order('created_at', { ascending: false }),
      supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }).limit(50)
    ]);
    
    if (st.data) setStats(st.data);
    if (s.data) setStores(s.data);
    if (l.data) setListings(l.data);
    if (o.data) setOrders(o.data);
    
    setBusy(false);
    setRef(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  // --- ACTIONS ---
  const approveStore = async (id: string) => {
    const { error } = await supabase.rpc('admin_approve_store', { p_store_id: id });
    if (error) Alert.alert('Error', error.message);
    else { setViewStore(null); load(); }
  };

  const suspendStore = (id: string) => {
    Alert.alert('Suspend Store?', 'They will not be able to sell until re-approved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Suspend', style: 'destructive', onPress: async () => {
        await supabase.rpc('admin_update_store_status', { p_store_id: id, p_status: 'rejected' });
        load();
      }},
    ]);
  };

  const approveListing = async (id: number) => {
    const { error } = await supabase.rpc('admin_approve_listing', { p_listing_id: id });
    if (error) Alert.alert('Error', error.message); else load();
  };

  const rejectListing = (id: number) => {
    Alert.alert('Reject Listing?', 'This will hide the listing from the marketplace.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reject', style: 'destructive', onPress: async () => {
        await supabase.from('marketplace_listings').update({ approval_status: 'rejected' }).eq('id', id);
        load();
      }},
    ]);
  };

  const featureListing = async (id: number) => {
    await supabase.rpc('admin_feature_listing', { p_listing_id: id, p_days: 7 });
    Alert.alert('Featured', 'Listing boosted to top for 7 days.');
    load();
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const TABS = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'stores', label: '🏪 Stores (' + stores.filter(s => s.status === 'pending').length + ')' },
    { id: 'listings', label: '📦 Listings (' + listings.filter(l => l.approval_status === 'pending').length + ')' },
    { id: 'orders', label: '🛒 Orders' },
  ];

  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Marketplace Admin</Text>

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

        {/* --- OVERVIEW TAB --- */}
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
              <Text style={styles.statVal}>{stats.active_stores}</Text>
              <Text style={styles.statLbl}>ACTIVE STORES</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: '#ffb300' }]}>{stats.pending_stores + stats.pending_listings}</Text>
              <Text style={styles.statLbl}>PENDING APPROVALS</Text>
            </View>
          </View>
        ) : null}

        {/* --- STORES TAB --- */}
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
              <Text style={styles.cardMeta}>📍 {s.location}</Text>
              <Text style={[styles.cardMeta, { color: palette.neon, marginTop: 8 }]}>Tap to view images & docs →</Text>
            </Pressable>
          ))
        ) : null}

        {/* --- LISTINGS TAB --- */}
        {tab === 'listings' ? (
          listings.map(l => (
            <View key={l.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{l.title}</Text>
                <Text style={[styles.statusChip, l.approval_status === 'approved' ? { color: '#00ff88', borderColor: '#00ff88' } : { color: '#ffb300', borderColor: '#ffb300' }]}>
                  {l.approval_status.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(l.price).toLocaleString()} · Qty: {l.quantity} {l.unit}</Text>
              <Text style={styles.cardMeta}>Seller: {l.seller_id.slice(0, 8)}</Text>
              
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {l.approval_status === 'pending' ? (
                  <>
                    <Pressable onPress={() => approveListing(l.id)} style={[styles.smallBtn, { backgroundColor: '#00ff88' }]}>
                      <Text style={{ fontWeight: '900', color: '#000', fontSize: 11 }}>APPROVE</Text>
                    </Pressable>
                    <Pressable onPress={() => rejectListing(l.id)} style={[styles.smallBtn, { borderColor: '#ff3b5c', borderWidth: 1 }]}>
                      <Text style={{ fontWeight: '900', color: '#ff3b5c', fontSize: 11 }}>REJECT</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => featureListing(l.id)} style={[styles.smallBtn, { borderColor: '#ffd700', borderWidth: 1 }]}>
                      <Text style={{ fontWeight: '900', color: '#ffd700', fontSize: 11 }}>FEATURE ⭐</Text>
                    </Pressable>
                    <Pressable onPress={() => rejectListing(l.id)} style={[styles.smallBtn, { borderColor: '#ff3b5c', borderWidth: 1 }]}>
                      <Text style={{ fontWeight: '900', color: '#ff3b5c', fontSize: 11 }}>SUSPEND</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          ))
        ) : null}

        {/* --- ORDERS TAB --- */}
        {tab === 'orders' ? (
          orders.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.cardTitle}>{o.listing_title}</Text>
                <Text style={styles.statusChip}>{o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(o.total).toLocaleString()} · Qty {o.quantity}</Text>
              <Text style={styles.cardMeta}>Ref: {o.order_ref}</Text>
            </View>
          ))
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

            <Text style={styles.section}>STORE IMAGES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {viewStore?.images?.length > 0 ? viewStore.images.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                )) : <Text style={styles.cardMeta}>No images uploaded.</Text>}
              </View>
            </ScrollView>

            <Text style={styles.section}>DOCUMENTS</Text>
            {viewStore?.documents?.length > 0 ? viewStore.documents.map((doc: string, i: number) => (
              <Pressable key={i} onPress={() => Linking.openURL(doc)} style={{ padding: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: palette.neon, fontWeight: 'bold' }}>📄 Open Document {i+1}</Text>
              </Pressable>
            )) : <Text style={styles.cardMeta}>No documents uploaded.</Text>}

            {viewStore?.status === 'pending' ? (
              <Pressable onPress={() => approveStore(viewStore.id)} style={[styles.btn, { backgroundColor: '#00ff88', marginTop: 20 }]}>
                <Text style={{ fontWeight: '900', color: '#000' }}>APPROVE STORE</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => suspendStore(viewStore.id)} style={[styles.btn, { borderColor: '#ff3b5c', borderWidth: 1, marginTop: 20 }]}>
                <Text style={{ fontWeight: '900', color: '#ff3b5c' }}>SUSPEND STORE</Text>
              </Pressable>
            )}
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
  
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginTop: 20, marginBottom: 8 },
});
