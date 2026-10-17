import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { generateAndShareReceipt, ReceiptOrder } from '../src/utils/receiptPdf';
import { success as hapticSuccess } from '../src/utils/haptics';

export default function EscrowReceipt() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { order_id } = useLocalSearchParams<{ order_id: string }>();
  const numId = Number(order_id);
  const [order, setOrder] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      if (!numId) { setBusy(false); return; }
      const { data } = await supabase.from('marketplace_orders').select('*').eq('id', numId).maybeSingle();
      setOrder(data);
      setBusy(false);
    })();
  }, [numId]);

  const generate = async () => {
    if (!order) return;
    setGenerating(true);
    const payload: ReceiptOrder = {
      id: String(order.id),
      order_ref: order.order_ref || String(order.id).slice(0, 12),
      listing_title: order.listing_title || 'Item',
      quantity: order.quantity || 0,
      total: order.total || 0,
      status: order.status || 'pending',
      payment_ref: order.payment_ref,
      created_at: order.created_at || new Date().toISOString(),
      buyer_email: order.buyer_email,
      seller_email: order.seller_email,
      buyer_name: order.buyer_name,
      delivery_method: order.delivery_method,
      delivery_fee: order.delivery_fee || 0,
    };
    const r = await generateAndShareReceipt(payload);
    setGenerating(false);
    if (r.error) Alert.alert('Could not generate PDF', r.error);
    else hapticSuccess();
  };

  if (busy) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;
  if (!order) return <View style={styles.center}><Text style={styles.emptyTitle}>Order not found</Text></View>;

  const rows: [string, string][] = [
    ['Order ID', order.order_ref || String(order.id).slice(0, 12)],
    ['Status', (order.status || 'pending').toUpperCase()],
    ['Item', order.listing_title || '—'],
    ['Quantity', String(order.quantity || 0)],
    ['Total', 'NGN ' + Math.round(order.total || 0).toLocaleString()],
    ['Delivery', order.delivery_method || 'pickup'],
    ['Buyer', order.buyer_name || order.buyer_email || '—'],
    ['Created', new Date(order.created_at).toLocaleString()],
    ['Payment ref', order.payment_ref || '—'],
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scroll}>
      <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
      <Text style={styles.title}>Escrow receipt</Text>
      <Text style={styles.sub}>Proof of purchase — downloadable PDF</Text>
      <View style={styles.card}>
        <Text style={styles.brand}>GAIA</Text>
        <Text style={styles.brandSub}>ESCROW RECEIPT</Text>
        <View style={styles.sep} />
        {rows.map(([k, v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v} numberOfLines={2}>{v}</Text>
          </View>
        ))}
        <View style={styles.sep} />
        <Text style={styles.terms}>Funds are held in escrow until the buyer confirms delivery. Disputes can be raised from the order screen within 7 days.</Text>
      </View>
      <Pressable onPress={generate} disabled={generating} style={[styles.cta, generating && { opacity: 0.5 }]}>
        {generating ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>GENERATE PDF & SHARE</Text>}
      </Pressable>
      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  card: { backgroundColor: p.surface, borderRadius: 20, padding: 22, borderWidth: 1, borderColor: p.border },
  brand: { fontSize: 30, fontWeight: '900', color: p.neon, letterSpacing: 8 },
  brandSub: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 2, marginTop: 4 },
  sep: { height: 1, backgroundColor: p.border, marginVertical: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  k: { fontSize: 11, color: p.textMuted },
  v: { fontSize: 12, color: p.text, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 12 },
  terms: { fontSize: 11, color: p.textMuted, lineHeight: 16, fontStyle: 'italic' },
  cta: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
});
