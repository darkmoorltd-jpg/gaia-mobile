import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, Modal, TextInput, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function OrganicMarket() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [giftItem, setGiftItem] = useState<any | null>(null);
  const [giftName, setGiftName] = useState('');
  const [giftPhone, setGiftPhone] = useState('');
  const [giftAddress, setGiftAddress] = useState('');
  const [giftQty, setGiftQty] = useState('1');
  const [gifting, setGifting] = useState(false);

  const load = async () => {
    setBusy(true);
    const { data } = await supabase.from('organic_products')
      .select('*, organic_sellers(business_name, lga, state, is_certified)')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setProducts(data || []);
    setBusy(false);
  };

  useEffect(() => { load(); }, []);

  const openGift = (item: any) => {
    if (!user) { Alert.alert('Sign in required', 'Please sign in to send gifts.'); return; }
    setGiftItem(item);
    setGiftQty('1');
  };

  const processGift = async () => {
    if (!giftItem) return;
    if (!giftName.trim() || !giftPhone.trim() || !giftAddress.trim()) {
      Alert.alert('Missing info', 'Recipient name, phone, and address are required.');
      return;
    }
    const q = parseFloat(giftQty);
    if (!Number.isFinite(q) || q <= 0) { Alert.alert('Invalid quantity'); return; }
    if (q > Number(giftItem.stock_quantity)) {
      Alert.alert('Insufficient stock', `Only ${giftItem.stock_quantity} ${giftItem.unit} available`);
      return;
    }

    setGifting(true);
    try {
      // Step 1: create payment intent
      const { data: charge, error: chErr } = await supabase.functions.invoke('charge-organic-order', {
        body: { purpose: 'gift', product_id: giftItem.id, quantity: q },
      });
      if (chErr) throw chErr;
      if (!charge?.ok) throw new Error(charge?.error || 'Payment init failed');

      // Step 2: open Paystack
      const r = await WebBrowser.openAuthSessionAsync(charge.authorization_url, 'gaia://organic-market');
      if (r.type !== 'success') return;

      // Step 3: poll for webhook + create order
      let created = false;
      for (let i = 0; i < 10; i++) {
        await new Promise(res => setTimeout(res, 1000));
        const { data: ord, error: ordErr } = await supabase.rpc('create_diaspora_gift_verified', {
          p_product_id: giftItem.id,
          p_quantity: q,
          p_recipient_name: giftName.trim(),
          p_recipient_phone: giftPhone.trim(),
          p_recipient_address: giftAddress.trim(),
          p_paystack_ref: charge.reference,
        });
        if (!ordErr && ord?.ok) {
          created = true;
          Alert.alert('Gift sent!', `GAIA will deliver ${giftItem.title} to ${giftName} within 3 days.`);
          break;
        }
        if (ordErr && !ordErr.message.includes('payment not verified')) {
          throw ordErr;
        }
      }
      if (!created) throw new Error('Payment is being confirmed. Please reopen the app in a minute — the gift will appear on your orders.');

      setGiftItem(null);
      setGiftName(''); setGiftPhone(''); setGiftAddress(''); setGiftQty('1');
      load();
    } catch (e: any) {
      Alert.alert('Gift failed', e.message || 'Try again');
    } finally {
      setGifting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>🌿 GAIA Organic</Text>
          <Text style={styles.heroSub}>Certified chemical-free food, delivered to your family.</Text>
          <Pressable onPress={() => router.push('/organic-orders' as any)} style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: '#ffd700', borderRadius: 8 }}>
            <Text style={{ color: '#ffd700', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>MY ORDERS →</Text>
          </Pressable>
        </View>

        <View style={styles.diasporaBanner}>
          <Text style={styles.diasporaTitle}>✈️ Shopping from abroad?</Text>
          <Text style={styles.diasporaSub}>Pay here, and we deliver fresh organic food directly to your parents in Nigeria.</Text>
        </View>

        <Text style={styles.sectionLabel}>FRESH ARRIVALS</Text>
        {busy ? <ActivityIndicator color={palette.neon} /> : null}
        {!busy && products.length === 0 ? (
          <View style={{ padding: 20, alignItems: 'center' }}>
            <Text style={{ color: palette.textMuted, marginBottom: 12 }}>No organic products yet.</Text>
            <Pressable onPress={() => router.push('/organic-storefront' as any)} style={styles.buyBtn}>
              <Text style={styles.buyBtnTxt}>BROWSE STOREFRONTS</Text>
            </Pressable>
          </View>
        ) : null}

        {products.map(item => {
          const img = (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=400';
          const sellerName = item.organic_sellers?.business_name || 'Seller';
          return (
            <View key={item.id} style={styles.card}>
              <Image source={{ uri: img }} style={styles.img} />
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemPrice}>₦{Number(item.price).toLocaleString()} <Text style={styles.unit}>/ {item.unit}</Text></Text>
                <Text style={styles.itemLoc}>📍 {sellerName}</Text>
                <Text style={styles.itemLoc}>In stock: {item.stock_quantity} {item.unit}</Text>

                <View style={styles.btnRow}>
                  <Pressable onPress={() => openGift(item)} style={styles.giftBtn}>
                    <Text style={styles.giftBtnTxt}>🎁 SEND AS GIFT</Text>
                  </Pressable>
                  <Pressable onPress={() => router.push(`/organic-storefront?sellerId=${item.seller_id}` as any)} style={styles.buyBtn}>
                    <Text style={styles.buyBtnTxt}>VISIT</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={!!giftItem} animationType="slide" transparent onRequestClose={() => !gifting && setGiftItem(null)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Send as Gift</Text>
            <Text style={styles.modalSub}>Ordering {giftItem?.title} for a loved one.</Text>

            <Text style={styles.label}>QUANTITY ({giftItem?.unit})</Text>
            <TextInput value={giftQty} onChangeText={setGiftQty} keyboardType="numeric" style={styles.input} placeholderTextColor="#888" />

            <Text style={styles.label}>RECIPIENT NAME</Text>
            <TextInput value={giftName} onChangeText={setGiftName} placeholder="e.g. Mama Ngozi" placeholderTextColor="#888" style={styles.input} />

            <Text style={styles.label}>RECIPIENT PHONE</Text>
            <TextInput value={giftPhone} onChangeText={setGiftPhone} keyboardType="phone-pad" placeholder="080..." placeholderTextColor="#888" style={styles.input} />

            <Text style={styles.label}>DELIVERY ADDRESS</Text>
            <TextInput value={giftAddress} onChangeText={setGiftAddress} multiline style={[styles.input, { height: 80 }]} placeholder="Full address in Nigeria" placeholderTextColor="#888" />

            {giftItem && (
              <View style={{ marginTop: 16, padding: 12, backgroundColor: 'rgba(255,215,0,0.08)', borderRadius: 10 }}>
                <Text style={{ color: palette.textMuted, fontSize: 11 }}>Total charged</Text>
                <Text style={{ color: '#ffd700', fontSize: 22, fontWeight: '900', marginTop: 4 }}>
                  ₦{((Number(giftItem.price) * (parseFloat(giftQty) || 0)) + 2500).toLocaleString()}
                </Text>
                <Text style={{ color: palette.textMuted, fontSize: 10, marginTop: 4 }}>
                  Includes ₦2,500 delivery fee
                </Text>
              </View>
            )}

            <Pressable onPress={processGift} disabled={gifting} style={[styles.payBtn, gifting && { opacity: 0.5 }]}>
              {gifting ? <ActivityIndicator color="#000" /> : <Text style={styles.payBtnTxt}>PAY WITH PAYSTACK</Text>}
            </Pressable>
            <Pressable onPress={() => !gifting && setGiftItem(null)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  hero: { marginBottom: 24, alignItems: 'center' },
  heroTitle: { fontSize: 32, fontWeight: '900', color: '#ffd700', letterSpacing: -1 },
  heroSub: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 8 },
  diasporaBanner: { backgroundColor: 'rgba(255,215,0,0.1)', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)', marginBottom: 24 },
  diasporaTitle: { color: '#ffd700', fontSize: 14, fontWeight: '900' },
  diasporaSub: { color: p.text, fontSize: 12, marginTop: 4, lineHeight: 18 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 2, marginBottom: 12 },
  card: { flexDirection: 'row', backgroundColor: p.surface, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: p.border, marginBottom: 12, gap: 12 },
  img: { width: 100, height: 100, borderRadius: 12 },
  itemTitle: { fontSize: 16, fontWeight: '800', color: p.text },
  itemPrice: { fontSize: 16, fontWeight: '900', color: '#ffd700', marginTop: 4 },
  unit: { fontSize: 11, color: p.textMuted, fontWeight: '400' },
  itemLoc: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  giftBtn: { flex: 2, backgroundColor: 'rgba(255,215,0,0.15)', borderWidth: 1, borderColor: '#ffd700', paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  giftBtnTxt: { fontSize: 10, fontWeight: '900', color: '#ffd700' },
  buyBtn: { flex: 1, backgroundColor: p.neon, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  buyBtnTxt: { fontSize: 10, fontWeight: '900', color: '#000' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#ffd700' },
  modalSub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { backgroundColor: p.surface, padding: 16, borderRadius: 12, color: p.text, borderWidth: 1, borderColor: p.border },
  payBtn: { backgroundColor: '#ffd700', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 24 },
  payBtnTxt: { fontSize: 12, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
