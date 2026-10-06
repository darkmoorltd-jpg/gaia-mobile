import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  fetchSellerListings, deleteListing, fetchSellerOrders, naira, getSellerSummary,
  SellerSummary,
} from '../src/utils/marketplace';

export default function SellerStore() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [listings, setListings] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [summary, setSummary] = useState<SellerSummary | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [ls, os, sm] = await Promise.all([
      fetchSellerListings(user.id),
      fetchSellerOrders(user.id),
      getSellerSummary(),
    ]);
    setListings(ls);
    setOrders(os);
    setSummary(sm);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onDelete = (id: number) => {
    Alert.alert('Delete listing?', 'This cannot be undone', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteListing(id); load(); } },
    ]);
  };

  const awaiting = summary ? summary.orders_awaiting_shipment : 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>My Store</Text>
        <Text style={styles.sub}>{user?.email}</Text>

        <View style={styles.walletCard}>
          <Text style={styles.walletLbl}>AVAILABLE BALANCE</Text>
          <Text style={styles.walletBal}>{naira(summary?.available_balance || 0)}</Text>
          <View style={styles.walletRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletMeta}>In escrow (pending delivery)</Text>
              <Text style={styles.walletMetaVal}>{naira(summary?.pending_escrow || 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.walletMeta}>Lifetime earned</Text>
              <Text style={styles.walletMetaVal}>{naira(summary?.lifetime_earned || 0)}</Text>
            </View>
          </View>
          <Pressable onPress={() => router.push('/wallet' as any)} style={styles.withdrawBtn}>
            <Text style={styles.withdrawTxt}>WITHDRAW TO BANK</Text>
          </Pressable>
        </View>

        <View style={styles.statRow}>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{listings.length}</Text>
            <Text style={styles.statLbl}>LISTINGS</Text>
          </View>
          <View style={styles.stat}>
            <Text style={[styles.statVal, awaiting > 0 && { color: '#ffb300' }]}>{awaiting}</Text>
            <Text style={styles.statLbl}>TO SHIP</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statVal}>{summary?.orders_completed || 0}</Text>
            <Text style={styles.statLbl}>COMPLETED</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push('/marketplace-sell' as any)} style={styles.addBtn}>
            <Text style={styles.addBtnTxt}>+ NEW LISTING</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/marketplace-orders' as any)} style={styles.ordersBtn}>
            <Text style={styles.ordersBtnTxt}>ORDERS ({summary?.orders_paid || 0})</Text>
          </Pressable>
        </View>

        {summary && summary.recent_payouts && summary.recent_payouts.length > 0 ? (
          <>
            <Text style={styles.section}>RECENT PAYOUTS</Text>
            {summary.recent_payouts.map((p: any, i: number) => (
              <View key={i} style={styles.payoutRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.payoutTitle} numberOfLines={1}>{p.listing_title || 'Order'}</Text>
                  <Text style={styles.payoutMeta}>
                    {p.released_at ? new Date(p.released_at).toLocaleDateString() : ''}
                  </Text>
                </View>
                <Text style={styles.payoutAmt}>+{naira(p.amount)}</Text>
              </View>
            ))}
          </>
        ) : null}

        <Text style={styles.section}>MY LISTINGS</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} /> : null}
        {!busy && listings.length === 0 ? <Text style={styles.empty}>No listings yet.</Text> : null}

        {listings.map((l) => (
          <View key={l.id} style={styles.card}>
            <Image
              source={{ uri: (l.images && l.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=400' }}
              style={styles.cardImg}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>{l.title}</Text>
              <Text style={styles.cardSub}>{naira(l.price)} {l.unit} · {l.quantity} left</Text>
              <Text style={styles.cardSub2}>Category: {l.category}</Text>
              <View style={styles.cardActions}>
                <Pressable onPress={() => router.push({ pathname: '/marketplace-product', params: { id: String(l.id) } } as any)} style={styles.smallBtn}>
                  <Text style={styles.smallBtnTxt}>VIEW</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(l.id)} style={styles.smallBtnDanger}>
                  <Text style={styles.smallBtnDangerTxt}>DELETE</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  walletCard: { padding: 20, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16 },
  walletLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  walletBal: { fontSize: 34, fontWeight: '900', color: p.neon, marginTop: 4, letterSpacing: -1.5 },
  walletRow: { flexDirection: 'row', gap: 16, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  walletMeta: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  walletMetaVal: { fontSize: 15, fontWeight: '900', color: p.text, marginTop: 4 },
  withdrawBtn: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center' },
  withdrawTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1.5 },
  statRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  addBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center' },
  addBtnTxt: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  ordersBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center' },
  ordersBtnTxt: { fontSize: 12, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  section: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 24, marginBottom: 12 },
  payoutRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  payoutTitle: { fontSize: 13, fontWeight: '700', color: p.text },
  payoutMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  payoutAmt: { fontSize: 14, fontWeight: '900', color: '#00ff88' },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  card: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardImg: { width: 80, height: 80, borderRadius: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  cardSub: { fontSize: 12, color: p.neon, marginTop: 3, fontWeight: '700' },
  cardSub2: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 6, marginTop: 8 },
  smallBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: p.neonSoft, borderWidth: 1, borderColor: p.borderHi },
  smallBtnTxt: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  smallBtnDanger: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.danger },
  smallBtnDangerTxt: { fontSize: 10, fontWeight: '900', color: p.danger, letterSpacing: 1 },
});
