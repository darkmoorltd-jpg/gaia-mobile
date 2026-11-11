
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import ReviewModal from '../src/components/ReviewModal';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

export default function InputMyOrders() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [reviewOrder, setReviewOrder] = useState<any>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('input_my_orders');
    setOrders(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cancelOrder = (id: string) => {
    Alert.prompt('Cancel this order?', 'Your money will be refunded to your escrow wallet immediately.', async (reason?: string) => {
        const { data, error } = await supabase.rpc('input_cancel_order', { p_order_id: id, p_reason: reason || null });
        if (error) { Alert.alert('Cannot cancel', error.message); return; }
        Alert.alert('Order cancelled', 'Refunded to wallet.');
        load();
      });
  };

  const confirmReceived = (id: string) => {
    Alert.alert('Confirm Delivery?', 'This releases your money from escrow to the seller.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Yes, I got it', onPress: async () => {
        const { error } = await supabase.rpc('input_confirm_received', { p_order_id: id });
        if (error) { Alert.alert('Failed', error.message); return; }
        load();
        const target = orders.find((o: any) => o.id === id);
        setReviewOrder({ id, product_name: target?.product_name });
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Input Orders</Text>
        <Text style={styles.sub}>{orders.length} order(s)</Text>

        {busy && orders.length === 0 ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && orders.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>No orders yet.</Text></View> : null}

        {orders.map((o) => (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.name}>{o.product_name}</Text>
                <Text style={styles.chip}>{o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{o.quantity} {o.product_unit} · {money(o.unit_price_ngn)} each</Text>
              <View style={styles.sellerBox}>
                <Text style={styles.sellerLabel}>SELLER</Text>
                <Text style={styles.sellerName}>{o.seller_name || 'Unknown Store'}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={styles.total}>{money(o.total_ngn)}</Text>
              </View>
              
              {o.payment_status === 'held_in_escrow' && o.status === 'pending' ? (
                <View style={{ marginTop: 12, flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => cancelOrder(o.id)} style={[styles.btn, { backgroundColor: '#ff3b5c' }]}><Text style={styles.btnText}>CANCEL</Text></Pressable>
                    <Pressable onPress={() => confirmReceived(o.id)} style={[styles.btn, { backgroundColor: '#00ff88' }]}><Text style={[styles.btnText, { color: '#000' }]}>I GOT IT</Text></Pressable>
                </View>
              ) : null}
            </View>
        ))}
        <View style={{ height: 60 }} />
      </ScrollView>
      <ReviewModal visible={!!reviewOrder} orderId={reviewOrder?.id || null} productName={reviewOrder?.product_name} onClose={() => setReviewOrder(null)} onSubmitted={() => { setReviewOrder(null); load(); }} />
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian }, scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 }, title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 }, card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text }, chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#ffb300', color: '#ffb300' },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 }, sellerBox: { marginTop: 10, padding: 10, backgroundColor: 'rgba(179,136,255,0.08)', borderRadius: 8 },
  sellerLabel: { fontSize: 9, fontWeight: '900', color: '#b388ff' }, sellerName: { fontSize: 13, fontWeight: '800', color: p.text, marginTop: 2 },
  total: { fontSize: 18, fontWeight: '900', color: '#b388ff' }, btn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', color: '#fff' }, empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted }
});
