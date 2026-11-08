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
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Input Orders</Text>
        <Text style={styles.sub}>{orders.length} order(s)</Text>

        {busy && orders.length === 0 ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && orders.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No orders yet. Browse farm inputs to buy fertilizer, seeds, or tools.</Text></View>
        ) : null}

        {orders.map((o) => {
          const isPaid = o.payment_status === 'held_in_escrow';
          const isReleased = o.payment_status === 'released';
          
          return (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.name}>{o.product_name}</Text>
                <Text style={[styles.chip, { color: isReleased ? '#00ff88' : '#ffb300', borderColor: isReleased ? '#00ff88' : '#ffb300' }]}>
                  {isReleased ? 'DELIVERED' : 'IN ESCROW'}
                </Text>
              </View>
              <Text style={styles.meta}>{o.quantity} {o.product_unit} · {money(o.unit_price_ngn)} each</Text>
              
              <View style={styles.sellerBox}>
                <Text style={styles.sellerLabel}>SELLER</Text>
                <Text style={styles.sellerName}>{o.seller_name || 'Unknown Store'}</Text>
                {o.seller_phone ? <Text style={styles.meta}>📞 {o.seller_phone}</Text> : null}
              </View>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                <Text style={styles.total}>{money(o.total_ngn)}</Text>
                <Text style={styles.meta}>Status: {o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>Delivery: {o.delivery_method} · {fmt(o.created_at)}</Text>
              
              {isPaid && o.status !== 'delivered' ? (
                <View style={{ marginTop: 12 }}>
                  <Text style={{ fontSize: 10, color: '#ffb300', marginBottom: 6, textAlign: 'center' }}>🔒 Money is safely held in Escrow until you confirm.</Text>
                  <Pressable onPress={() => confirmReceived(o.id)} style={styles.btn}>
                    <Text style={styles.btnText}>CONFIRM DELIVERY & RELEASE PAYMENT</Text>
                  </Pressable>
                </View>
              ) : null}
              {isReleased ? (
                <Text style={{ color: '#00ff88', fontSize: 12, fontWeight: '800', textAlign: 'center', marginTop: 12 }}>✅ Payment Released to Seller</Text>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
      <ReviewModal
        visible={!!reviewOrder}
        orderId={reviewOrder?.id || null}
        productName={reviewOrder?.product_name}
        onClose={() => setReviewOrder(null)}
        onSubmitted={() => { setReviewOrder(null); load(); }}
      />
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  chip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  sellerBox: { marginTop: 10, padding: 10, backgroundColor: 'rgba(179,136,255,0.08)', borderRadius: 8 },
  sellerLabel: { fontSize: 9, fontWeight: '900', color: '#b388ff', letterSpacing: 1 },
  sellerName: { fontSize: 13, fontWeight: '800', color: p.text, marginTop: 2 },
  total: { fontSize: 18, fontWeight: '900', color: '#b388ff' },
  btn: { paddingVertical: 12, borderRadius: 10, backgroundColor: '#00ff88', alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
