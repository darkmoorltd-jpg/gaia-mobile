import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function OrganicOrders() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data } = await supabase.from('organic_orders')
      .select('*, organic_products(title, unit), organic_sellers(business_name)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });
    setOrders(data || []);
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmDelivery = (order: any) => {
    Alert.alert('Confirm delivery?', `Release ₦${Number(order.seller_payout).toLocaleString()} to seller? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Confirm', onPress: async () => {
        try {
          const { error } = await supabase.rpc('release_organic_escrow', { p_order_id: String(order.id) });
          if (error) throw error;
          Alert.alert('Confirmed', 'Seller credited.');
          load();
        } catch (e: any) { Alert.alert('Failed', e.message); }
      }},
    ]);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Organic Orders</Text>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}
        {!busy && orders.length === 0 ? <Text style={styles.empty}>No organic orders yet.</Text> : null}

        {orders.map(o => {
          const statusColor =
            o.status === 'completed' ? palette.neon :
            o.status === 'delivered' ? '#3b82f6' :
            o.status === 'shipped' ? '#ffb300' : '#888';
          return (
            <View key={o.id} style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={styles.prodName}>{o.organic_products?.title || 'Product'} × {o.quantity}</Text>
                <Text style={[styles.status, { color: statusColor }]}>{o.status.toUpperCase()}</Text>
              </View>
              <Text style={styles.meta}>{o.organic_sellers?.business_name || 'Seller'}</Text>
              <Text style={styles.meta}>Paid: ₦{Number(o.total_paid).toLocaleString()} · Seller gets ₦{Number(o.seller_payout).toLocaleString()}</Text>
              {o.tracking_number ? <Text style={styles.meta}>Tracking: {o.tracking_number}</Text> : null}
              <Text style={styles.time}>{new Date(o.created_at).toLocaleString()}</Text>

              {o.status === 'delivered' ? (
                <Pressable onPress={() => confirmDelivery(o)} style={styles.confirmBtn}>
                  <Text style={styles.confirmTxt}>CONFIRM DELIVERY & RELEASE</Text>
                </Pressable>
              ) : null}
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
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 1.5, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text, marginBottom: 16 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 40, fontStyle: 'italic' },
  card: { backgroundColor: p.surface, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  prodName: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1 },
  status: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  meta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  time: { fontSize: 10, color: p.textDim, marginTop: 6 },
  confirmBtn: { marginTop: 12, backgroundColor: '#3b82f6', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  confirmTxt: { fontSize: 11, fontWeight: '900', color: '#fff', letterSpacing: 1 },
});
