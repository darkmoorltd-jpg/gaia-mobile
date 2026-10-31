import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { fetchSellerListings, deleteListing, fetchSellerOrders, naira, getSellerSummary, SellerSummary } from '../src/utils/marketplace';

export default function SellerStore() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [listings, setListings] = useState<any[]>([]);
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const [store, setStore] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [rating, setRating] = useState({ avg: 0, count: 0 });
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    
    // Fetch store
    const { data: storeData } = await supabase.from('marketplace_stores').select('*').eq('seller_id', user.id).maybeSingle();
    setStore(storeData);

    // Fetch listings & summary
    const [ls, sm] = await Promise.all([ fetchSellerListings(user.id), getSellerSummary() ]);
    setListings(ls);
    setSummary(sm);

    // Fetch chart
    const { data: chartData } = await supabase.rpc('seller_sales_last_7_days');
    setChart(chartData || []);

    // Fetch rating
    const { data: reviews } = await supabase.from('marketplace_reviews').select('rating').eq('seller_id', user.id);
    if (reviews && reviews.length > 0) {
      const sum = reviews.reduce((a, b) => a + b.rating, 0);
      setRating({ avg: sum / reviews.length, count: reviews.length });
    } else {
      setRating({ avg: 0, count: 0 });
    }

    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (id: number) => {
    Alert.alert('Delete listing?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteListing(id); load(); } },
    ]);
  };

  const boostListing = async (id: number) => {
    Alert.alert('Boost Listing?', 'Costs ₦1,000 from wallet for 7 days at the top.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Boost', onPress: async () => {
        const { error } = await supabase.rpc('seller_boost_listing', { p_listing_id: id });
        if (error) Alert.alert('Failed', error.message);
        else { Alert.alert('Success', 'Listing boosted for 7 days!'); load(); }
      }},
    ]);
  };

  if (!store) return null; // Gated by marketplace-store logic already

  const awaiting = summary ? summary.orders_awaiting_shipment : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.title}>{store.store_name}</Text>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 16, color: '#ffd700', fontWeight: '900' }}>★ {rating.avg.toFixed(1)}</Text>
            <Text style={{ fontSize: 10, color: '#888' }}>{rating.count} reviews</Text>
          </View>
        </View>
        <Text style={styles.sub}>{store.store_type.toUpperCase()} Store · {store.location}</Text>

        {/* Wallet Card */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLbl}>AVAILABLE BALANCE</Text>
          <Text style={styles.walletBal}>{naira(summary?.available_balance || 0)}</Text>
          <View style={styles.walletRow}>
            <View style={{ flex: 1 }}><Text style={styles.walletMeta}>In escrow</Text><Text style={styles.walletMetaVal}>{naira(summary?.pending_escrow || 0)}</Text></View>
            <View style={{ flex: 1 }}><Text style={styles.walletMeta}>Lifetime earned</Text><Text style={styles.walletMetaVal}>{naira(summary?.lifetime_earned || 0)}</Text></View>
          </View>
          <Pressable onPress={() => router.push('/wallet' as any)} style={styles.withdrawBtn}><Text style={styles.withdrawTxt}>WITHDRAW TO BANK</Text></Pressable>
        </View>

        {/* 7-Day Sales Chart */}
        <Text style={styles.section}>7-DAY SALES</Text>
        <View style={styles.chartBox}>
          {chart.length === 0 ? <Text style={{ color: '#888', fontSize: 12 }}>No sales yet this week.</Text> : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 }}>
              {chart.map((c, i) => {
                const max = Math.max(...chart.map(x => x.total)) || 1;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <View style={{ width: '100%', backgroundColor: palette.neon, height: `${(c.total / max) * 100}%`, borderRadius: 4 }} />
                    <Text style={{ fontSize: 9, color: '#888', marginTop: 4 }}>{c.day}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/marketplace-sell' as any)} style={styles.addBtn}><Text style={styles.addBtnTxt}>+ NEW LISTING</Text></Pressable>
          <Pressable onPress={() => router.push('/marketplace-orders' as any)} style={styles.ordersBtn}><Text style={styles.ordersBtnTxt}>ORDERS ({awaiting})</Text></Pressable>
        </View>

        <Text style={styles.section}>MY LISTINGS</Text>
        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} /> : null}
        {!busy && listings.length === 0 ? <Text style={styles.empty}>No listings yet.</Text> : null}

        {listings.map((l) => {
          const isFeatured = l.featured_until && new Date(l.featured_until) > new Date();
          return (
            <View key={l.id} style={styles.card}>
              <Image source={{ uri: (l.images && l.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400' }} style={styles.cardImg} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
                  {isFeatured ? <Text style={{ fontSize: 10, color: '#ffd700', fontWeight: '900' }}>⚡ BOOSTED</Text> : null}
                </View>
                <Text style={styles.cardSub}>{naira(l.price)} {l.unit} · {l.quantity} left</Text>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => router.push({ pathname: '/marketplace-product', params: { id: String(l.id) } } as any)} style={styles.smallBtn}><Text style={styles.smallBtnTxt}>VIEW</Text></Pressable>
                  <Pressable onPress={() => router.push({ pathname: '/marketplace-sell', params: { id: String(l.id) } } as any)} style={styles.smallBtn}><Text style={styles.smallBtnTxt}>EDIT</Text></Pressable>
                  {!isFeatured ? (
                    <Pressable onPress={() => boostListing(l.id)} style={[styles.smallBtn, { borderColor: '#ffd700' }]}><Text style={[styles.smallBtnTxt, { color: '#ffd700' }]}>BOOST ⚡</Text></Pressable>
                  ) : null}
                  <Pressable onPress={() => onDelete(l.id)} style={styles.smallBtnDanger}><Text style={styles.smallBtnDangerTxt}>DEL</Text></Pressable>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  walletCard: { padding: 20, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  walletLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  walletBal: { fontSize: 34, fontWeight: '900', color: p.neon, marginTop: 4, letterSpacing: -1.5 },
  walletRow: { flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  walletMeta: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  walletMetaVal: { fontSize: 15, fontWeight: '900', color: p.text, marginTop: 4 },
  withdrawBtn: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  withdrawTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  chartBox: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  addBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  addBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  ordersBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  ordersBtnTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardImg: { width: 80, height: 80, borderRadius: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  cardSub: { fontSize: 12, color: p.neon, marginTop: 3, fontWeight: '700' },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  smallBtnTxt: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  smallBtnDanger: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.danger },
  smallBtnDangerTxt: { fontSize: 10, fontWeight: '900', color: p.danger, letterSpacing: 1 },
});
