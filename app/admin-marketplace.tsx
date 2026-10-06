import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, ActivityIndicator, RefreshControl, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function AdminMarketplace() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [tab, setTab] = useState<'listings' | 'orders'>('listings');
  const [data, setData] = useState<any>({ listings: [], orders: [] });
  const [busy, setBusy] = useState(true);
  const [action, setAction] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const { data, error } = await supabase.rpc('admin_list_marketplace');
    if (!error) setData(data || { listings: [], orders: [] });
    setBusy(false); setRefreshing(false);
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  const removeListing = (l: any) => {
    Alert.alert('Remove listing?', `"${l.title}" — irreversible.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: async () => {
        setAction(true);
        const { error } = await supabase.rpc('admin_remove_listing', { p_listing_id: l.id });
        setAction(false);
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  const featureListing = (l: any) => {
    Alert.alert('Feature listing', 'Feature for how many days?', [
      { text: 'Cancel', style: 'cancel' },
      { text: '7 days', onPress: async () => {
        setAction(true);
        const { error } = await supabase.rpc('admin_feature_listing', { p_listing_id: l.id, p_days: 7 });
        setAction(false);
        if (error) Alert.alert('Failed', error.message); else load();
      }},
      { text: '30 days', onPress: async () => {
        setAction(true);
        const { error } = await supabase.rpc('admin_feature_listing', { p_listing_id: l.id, p_days: 30 });
        setAction(false);
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const listings = data.listings || [];
  const orders = data.orders || [];

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Marketplace</Text>
        <Text style={styles.sub}>{listings.length} listings · {orders.length} orders</Text>

        <View style={styles.tabBar}>
          <Pressable onPress={() => setTab('listings')} style={[styles.tabBtn, tab === 'listings' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === 'listings' && styles.tabTextActive]}>Listings ({listings.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('orders')} style={[styles.tabBtn, tab === 'orders' && styles.tabBtnActive]}>
            <Text style={[styles.tabText, tab === 'orders' && styles.tabTextActive]}>Orders ({orders.length})</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} /> : null}

        {tab === 'listings' ? (
          listings.map((l: any) => (
            <View key={l.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{l.title || 'Listing'}</Text>
                {l.featured_until && new Date(l.featured_until) > new Date() ? (
                  <Text style={styles.chipHi}>FEATURED</Text>
                ) : null}
              </View>
              <Text style={styles.cardMeta}>₦{Number(l.price || 0).toLocaleString()} · qty {l.quantity || 0} {l.unit || ''}</Text>
              <Text style={styles.cardMeta}>{l.category || 'uncategorized'} · 📍 {l.location || '—'}</Text>
              <Text style={styles.cardMeta}>Seller: {l.seller_email || l.seller_id}</Text>
              <Text style={styles.cardMeta}>Created {new Date(l.created_at).toLocaleString()}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Pressable disabled={action} onPress={() => featureListing(l)} style={[styles.smallBtn, { borderColor: palette.neon }]}>
                  <Text style={[styles.smallBtnText, { color: palette.neon }]}>FEATURE</Text>
                </Pressable>
                <Pressable disabled={action} onPress={() => removeListing(l)} style={[styles.smallBtn, { borderColor: palette.danger }]}>
                  <Text style={[styles.smallBtnText, { color: palette.danger }]}>REMOVE</Text>
                </Pressable>
              </View>
            </View>
          ))
        ) : (
          orders.map((o: any) => (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.cardTitle} numberOfLines={1}>{o.listing_title || 'Order'}</Text>
                <Text style={styles.chip}>{(o.status || '').toUpperCase()}</Text>
              </View>
              <Text style={styles.cardMeta}>₦{Number(o.total || 0).toLocaleString()} · qty {o.quantity}</Text>
              <Text style={styles.cardMeta}>Ref: {(o.order_ref || '').slice(0, 18)}</Text>
              <Text style={styles.cardMeta}>{new Date(o.created_at).toLocaleString()}</Text>
            </View>
          ))
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  tabBar: { flexDirection: 'row', gap: 6, marginBottom: 16, backgroundColor: p.surface, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: p.border },
  tabBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabBtnActive: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  tabTextActive: { color: p.neon },
  card: { padding: 14, borderRadius: 12, backgroundColor: p.surface, marginBottom: 10, borderWidth: 1, borderColor: p.border },
  cardTitle: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1, marginRight: 8 },
  cardMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  chip: { fontSize: 9, fontWeight: '900', color: p.textMuted, letterSpacing: 1, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  chipHi: { fontSize: 9, fontWeight: '900', color: p.neon, letterSpacing: 1, backgroundColor: 'rgba(0,255,136,0.12)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  smallBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  smallBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
