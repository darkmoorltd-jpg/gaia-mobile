import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, Image, Modal, Linking } from 'react-native';
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

  const [tab, setTab] = useState<'stores' | 'listings' | 'orders'>('stores');
  const [stores, setStores] = useState<any[]>([]);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  
  const [viewStore, setViewStore] = useState<any | null>(null);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const [s, l, o] = await Promise.all([
      supabase.from('marketplace_stores').select('*').eq('status', 'pending'),
      supabase.from('marketplace_listings').select('*').eq('approval_status', 'pending'),
      supabase.from('marketplace_orders').select('*').order('created_at', { ascending: false }).limit(50)
    ]);
    setStores(s.data || []);
    setListings(l.data || []);
    setOrders(o.data || []);
    setBusy(false);
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

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Marketplace Admin</Text>

        <View style={styles.tabBar}>
          {(['stores', 'listings', 'orders'] as const).map(t => (
            <Pressable key={t} onPress={() => setTab(t)} style={[styles.tabBtn, tab === t && styles.tabBtnActive]}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'stores' ? 'Store Apps (' + stores.length + ')' : t === 'listings' ? 'Listing Apps (' + listings.length + ')' : 'Orders'}
              </Text>
            </Pressable>
          ))}
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'stores' ? (
          stores.map(s => (
            <Pressable key={s.id} onPress={() => setViewStore(s)} style={styles.card}>
              <Text style={styles.cardTitle}>{s.store_name} ({s.store_type.toUpperCase()})</Text>
              <Text style={styles.cardMeta}>Seller ID: {s.seller_id.slice(0, 8)}</Text>
              <Text style={styles.cardMeta}>Location: {s.location}</Text>
              <Text style={styles.cardMeta}>Billing: {s.billing_cycle}</Text>
              <Text style={[styles.cardMeta, { color: palette.neon, marginTop: 8 }]}>Tap to view images & docs →</Text>
            </Pressable>
          ))
        ) : tab === 'listings' ? (
          listings.map(l => (
            <View key={l.id} style={styles.card}>
              <Text style={styles.cardTitle}>{l.title}</Text>
              <Text style={styles.cardMeta}>₦{l.price.toLocaleString()} · Qty: {l.quantity}</Text>
              <Text style={styles.cardMeta}>Seller ID: {l.seller_id.slice(0, 8)}</Text>
              <Pressable onPress={() => approveListing(l.id)} style={[styles.btn, { backgroundColor: palette.neon, marginTop: 10 }]}>
                <Text style={{ fontWeight: '900', color: '#000' }}>APPROVE LISTING</Text>
              </Pressable>
            </View>
          ))
        ) : (
          orders.map(o => (
            <View key={o.id} style={styles.card}>
              <Text style={styles.cardTitle}>{o.listing_title}</Text>
              <Text style={styles.cardMeta}>₦{o.total.toLocaleString()} · {o.status}</Text>
            </View>
          ))
        )}
        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!viewStore} transparent animationType="slide" onRequestClose={() => setViewStore(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Pressable onPress={() => setViewStore(null)}><Text style={styles.back}>CLOSE</Text></Pressable>
            <Text style={styles.title}>{viewStore?.store_name}</Text>
            <Text style={styles.cardMeta}>{viewStore?.location} · {viewStore?.store_type}</Text>

            <Text style={styles.section}>STORE IMAGES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {viewStore?.images?.map((img: string, i: number) => (
                  <Image key={i} source={{ uri: img }} style={{ width: 120, height: 120, borderRadius: 8 }} />
                ))}
              </View>
            </ScrollView>

            <Text style={styles.section}>DOCUMENTS</Text>
            {viewStore?.documents?.map((doc: string, i: number) => (
              <Pressable key={i} onPress={() => Linking.openURL(doc)} style={{ padding: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderRadius: 8, marginBottom: 8 }}>
                <Text style={{ color: palette.neon, fontWeight: 'bold' }}>📄 Open Document {i+1}</Text>
              </Pressable>
            ))}

            <Pressable onPress={() => approveStore(viewStore?.id)} style={[styles.btn, { backgroundColor: palette.neon, marginTop: 20 }]}>
              <Text style={{ fontWeight: '900', color: '#000' }}>APPROVE STORE</Text>
            </Pressable>
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
  tabBar: { flexDirection: 'row', gap: 6, marginVertical: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 10, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  btn: { paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.obsidian, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' },
  section: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, color: p.neon, marginTop: 20, marginBottom: 8 },
});
