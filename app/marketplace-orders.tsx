import { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image,
  ActivityIndicator, Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../src/theme';
import { useAuth } from '../src/store/auth';
import {
  fetchBuyerOrders, fetchSellerOrders, updateOrderStatus,
  naira, statusColor,
} from '../src/utils/marketplace';
import { getSellerProfile } from '../src/utils/marketplace';
import { displayName } from '../src/utils/friends';

export default function Orders() {
  const router = useRouter();
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [tab, setTab] = useState<'buyer' | 'seller'>('buyer');
  const [buyerOrders, setBuyerOrders] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const [b, s] = await Promise.all([
      fetchBuyerOrders(user.id),
      fetchSellerOrders(user.id),
    ]);
    setBuyerOrders(b);
    setSellerOrders(s);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const chatWithSeller = async (sellerId: string) => {
    const prof = await getSellerProfile(sellerId);
    router.push({
      pathname: '/chat-room',
      params: {
        peerId: sellerId,
        peerName: displayName(prof) || 'Seller',
        peerEmail: prof.email || '',
      },
    } as any);
  };

  const chatWithBuyer = (order: any) => {
    router.push({
      pathname: '/chat-room',
      params: {
        peerId: order.buyer_id,
        peerName: order.buyer_name || 'Buyer',
        peerEmail: '',
      },
    } as any);
  };

  const confirmDelivery = (order: any) => {
    Alert.alert('Confirm delivery?', 'This releases payment from escrow to the seller.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await updateOrderStatus(order.id, 'confirmed');
          load();
        },
      },
    ]);
  };

  const markShipped = async (order: any) => {
    await updateOrderStatus(order.id, 'shipped');
    load();
  };

  const list = tab === 'buyer' ? buyerOrders : sellerOrders;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>
        <Text style={styles.title}>Orders</Text>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('buyer')} style={[styles.tab, tab === 'buyer' && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === 'buyer' && styles.tabTxtActive]}>My Orders ({buyerOrders.length})</Text>
          </Pressable>
          <Pressable onPress={() => setTab('seller')} style={[styles.tab, tab === 'seller' && styles.tabActive]}>
            <Text style={[styles.tabTxt, tab === 'seller' && styles.tabTxtActive]}>Incoming ({sellerOrders.length})</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} /> : null}

        {!busy && list.length === 0 ? (
          <Text style={styles.empty}>No orders yet.</Text>
        ) : null}

        {list.map((o) => {
          const sColor = statusColor(o.status, palette);
          return (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.ref}>#{o.order_ref}</Text>
                <View style={[styles.statusPill, { borderColor: sColor + '88' }]}>
                  <Text style={[styles.statusTxt, { color: sColor }]}>
                    {(o.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>

              <View style={styles.cardBody}>
                {o.listing_image ? (
                  <Image source={{ uri: o.listing_image }} style={styles.thumb} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{o.listing_title}</Text>
                  <Text style={styles.itemSub}>{o.quantity} × {naira(o.subtotal || 0)}</Text>
                  <Text style={styles.total}>{naira(o.total || 0)}</Text>
                </View>
              </View>

              <Text style={styles.meta}>
                {o.delivery_method === 'home' ? 'Home delivery' : 'Pickup'} · {o.delivery_address}
              </Text>
              {o.buyer_name ? <Text style={styles.meta}>Buyer: {o.buyer_name}</Text> : null}
              {o.buyer_phone ? <Text style={styles.meta}>Phone: {o.buyer_phone}</Text> : null}

              <View style={styles.actions}>
                {tab === 'buyer' ? (
                  <>
                    <Pressable onPress={() => chatWithSeller(o.seller_id)} style={styles.chatBtn}>
                      <Text style={styles.chatBtnTxt}>💬 CHAT SELLER</Text>
                    </Pressable>
                    {o.status === 'delivered' ? (
                      <Pressable onPress={() => confirmDelivery(o)} style={styles.confirmBtn}>
                        <Text style={styles.confirmBtnTxt}>CONFIRM DELIVERY</Text>
                      </Pressable>
                    ) : null}
                  </>
                ) : (
                  <>
                    <Pressable onPress={() => chatWithBuyer(o)} style={styles.chatBtn}>
                      <Text style={styles.chatBtnTxt}>💬 CHAT BUYER</Text>
                    </Pressable>
                    {o.status === 'paid' || o.status === 'pending' ? (
                      <Pressable onPress={() => markShipped(o)} style={styles.confirmBtn}>
                        <Text style={styles.confirmBtnTxt}>MARK SHIPPED</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
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
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginBottom: 16 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tab: {
    flex: 1, paddingVertical: 12, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: p.neonSoft, borderColor: p.borderHi },
  tabTxt: { fontSize: 12, fontWeight: '800', color: p.textMuted },
  tabTxtActive: { color: p.neon },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 40 },
  card: {
    padding: 16, borderRadius: 16, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  ref: { fontSize: 11, color: p.textDim, fontFamily: 'monospace' },
  statusPill: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1,
  },
  statusTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  cardBody: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  thumb: { width: 60, height: 60, borderRadius: 10 },
  itemTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  itemSub: { fontSize: 12, color: p.textMuted, marginTop: 2 },
  total: { fontSize: 16, fontWeight: '900', color: p.neon, marginTop: 4 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  chatBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center',
  },
  chatBtnTxt: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 0.5 },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: 10,
    backgroundColor: p.neon, alignItems: 'center',
  },
  confirmBtnTxt: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 0.5 },
});
