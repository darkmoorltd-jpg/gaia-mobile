import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
const fmt = (s?: string) => s ? new Date(s).toLocaleString() : '—';

export default function ProviderOrders() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('provider_my_orders');
    setOrders(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const updateStatus = (id: string, status: string) => {
    Alert.alert('Update order?', `Mark as ${status.toUpperCase()}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        const { error } = await supabase.rpc('provider_update_order_status', { p_order_id: id, p_status: status });
        if (error) Alert.alert('Failed', error.message); else load();
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.sub}>{orders.length} order(s)</Text>

        {busy && orders.length === 0 ? <ActivityIndicator color={palette.neon} /> : null}

        {!busy && orders.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No orders yet. Farmers will see your products in the marketplace.</Text></View>
        ) : null}

        {orders.map((o) => {
          const color = o.status === 'delivered' ? '#00ff88' : o.status === 'cancelled' ? '#ff3b5c' : o.status === 'pending' ? '#ffb300' : '#4fc3f7';
          return (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.name}>{o.product_name || 'Product'}</Text>
                <Text style={[styles.statusChip, { color, borderColor: color }]}>{String(o.status || '').toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{o.quantity} {o.product_unit} · {money(o.unit_price_ngn)} each</Text>
              <Text style={styles.total}>{money(o.total_ngn)}</Text>
              <Text style={styles.meta}>Buyer: {o.buyer_name || o.buyer_email}</Text>
              <Text style={styles.meta}>Delivery: {o.delivery_method} · {fmt(o.created_at)}</Text>
              <Text style={styles.meta}>Payment: {o.payment_status}</Text>

              {o.status === 'pending' && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                  <Pressable onPress={() => updateStatus(o.id, 'confirmed')} style={[styles.btn, { borderColor: '#00ff88' }]}>
                    <Text style={[styles.btnText, { color: '#00ff88' }]}>CONFIRM</Text>
                  </Pressable>
                  <Pressable onPress={() => updateStatus(o.id, 'cancelled')} style={[styles.btn, { borderColor: '#ff3b5c' }]}>
                    <Text style={[styles.btnText, { color: '#ff3b5c' }]}>CANCEL</Text>
                  </Pressable>
                </View>
              )}
              {o.status === 'confirmed' && (
                <Pressable onPress={() => updateStatus(o.id, 'shipped')} style={[styles.btn, { borderColor: '#4fc3f7', marginTop: 10 }]}>
                  <Text style={[styles.btnText, { color: '#4fc3f7' }]}>MARK SHIPPED</Text>
                </Pressable>
              )}
              {o.status === 'shipped' && (
                <Pressable onPress={() => updateStatus(o.id, 'delivered')} style={[styles.btn, { borderColor: '#00ff88', marginTop: 10 }]}>
                  <Text style={[styles.btnText, { color: '#00ff88' }]}>MARK DELIVERED</Text>
                </Pressable>
              )}
            </View>
          );
        })}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center', lineHeight: 18 },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  statusChip: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, letterSpacing: 0.5 },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  total: { fontSize: 18, fontWeight: '900', color: '#b388ff', marginTop: 4 },
  btn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  btnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
});
