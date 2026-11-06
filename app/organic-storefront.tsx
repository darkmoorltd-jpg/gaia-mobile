import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function OrganicStorefront() {
  const router = useRouter();
  const { palette } = useTheme();
  const { sellerId } = useLocalSearchParams<{ sellerId?: string }>();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [sellers, setSellers] = useState<any[]>([]);
  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [qty, setQty] = useState('1');
  const [buying, setBuying] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    if (sellerId) {
      const { data: s } = await supabase.from('organic_sellers').select('*').eq('id', sellerId).maybeSingle();
      setSeller(s);
      const { data: p } = await supabase.from('organic_products').select('*').eq('seller_id', sellerId).eq('status', 'active');
      setProducts(p || []);
    } else {
      const { data } = await supabase.from('organic_sellers').select('*').eq('status', 'active').order('is_certified', { ascending: false });
      setSellers(data || []);
    }
    setBusy(false);
  }, [sellerId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const buy = async () => {
    if (!user) { Alert.alert('Please log in'); return; }
    if (!selected) return;
    const quantity = parseFloat(qty);
    if (isNaN(quantity) || quantity <= 0) { Alert.alert('Invalid quantity'); return; }

    setBuying(true);
    const ref = 'GAIA_ORD_' + Date.now().toString(36).toUpperCase();
    const { data, error } = await supabase.rpc('create_organic_order', {
      p_product_id: selected.id,
      p_quantity: quantity,
      p_payment_ref: ref,
    });
    setBuying(false);
    if (error) { Alert.alert('Order failed', error.message); return; }
    Alert.alert('Order Placed!', `Total ₦${Number(data.total_paid).toLocaleString()}\nGAIA fee: ₦${Number(data.gaia_fee).toLocaleString()}\nFunds held in escrow for 3 days.`);
    setSelected(null);
    setQty('1');
    load();
  };

  const filtered = search.trim() && !sellerId
    ? sellers.filter(s => s.business_name.toLowerCase().includes(search.toLowerCase()))
    : sellers;

  if (busy) return <View style={styles.container}><ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} /></View>;

  // ---- Single seller view ----
  if (seller) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>{seller.business_name}</Text>
          <Text style={styles.sub}>📍 {seller.lga}, {seller.state}</Text>
          {seller.is_certified ? (
            <View style={styles.certBadge}><Text style={styles.certText}>✅ GAIA CERTIFIED ORGANIC</Text></View>
          ) : null}

          <Text style={styles.sectionLabel}>PRODUCTS</Text>
          {products.length === 0 ? <Text style={styles.empty}>No products available.</Text> : null}
          {products.map(p => (
            <Pressable key={p.id} onPress={() => setSelected(p)} style={styles.prodCard}>
              <Image source={{ uri: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=400' }} style={styles.prodImg} />
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.prodTitle}>{p.title}</Text>
                <Text style={styles.prodPrice}>₦{Number(p.price).toLocaleString()} / {p.unit}</Text>
                <Text style={styles.prodStock}>In stock: {p.stock_quantity} {p.unit}</Text>
              </View>
            </Pressable>
          ))}
          <View style={{ height: 80 }} />
        </ScrollView>

        <Modal visible={!!selected} animationType="slide" transparent onRequestClose={() => setSelected(null)}>
          <View style={styles.modalBg}>
            <View style={styles.modalSheet}>
              <Text style={styles.title}>{selected?.title}</Text>
              <Text style={styles.label}>QUANTITY ({selected?.unit})</Text>
              <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
              {selected && !isNaN(parseFloat(qty)) ? (
                <View style={styles.totalBox}>
                  <Text style={styles.totalLbl}>TOTAL</Text>
                  <Text style={styles.totalVal}>₦{(Number(selected.price) * parseFloat(qty || '0')).toLocaleString()}</Text>
                  <Text style={styles.totalSub}>3-day escrow · auto-release</Text>
                </View>
              ) : null}
              <Pressable onPress={buy} disabled={buying} style={styles.cta}>
                {buying ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>BUY NOW</Text>}
              </Pressable>
              <Pressable onPress={() => setSelected(null)} style={{ marginTop: 16, alignItems: 'center' }}>
                <Text style={{ color: palette.textMuted }}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Browse all sellers ----
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>🌿 GAIA Organic Market</Text>
        <Text style={styles.sub}>Certified chemical-free produce from verified farms</Text>

        <TextInput value={search} onChangeText={setSearch} placeholder="Search sellers..." placeholderTextColor={palette.textDim} style={styles.search} />

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>No organic sellers yet. Check back soon!</Text>
            <Pressable onPress={() => router.push('/organic-seller-register' as any)} style={styles.cta}>
              <Text style={styles.ctaText}>BECOME A SELLER</Text>
            </Pressable>
          </View>
        ) : null}

        {filtered.map(s => (
          <Pressable key={s.id} onPress={() => router.push(('/organic-storefront?sellerId=' + s.id) as any)} style={styles.sellerCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sellerName}>{s.business_name}</Text>
              <Text style={styles.sellerLoc}>📍 {s.lga}, {s.state}</Text>
              {s.is_certified ? <Text style={styles.certTextSmall}>✅ GAIA Certified</Text> : null}
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  back: { fontSize: 11, fontWeight: '800', color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  search: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 12 },
  certBadge: { backgroundColor: 'rgba(0,255,136,0.12)', borderWidth: 1, borderColor: p.neon, borderRadius: 8, padding: 10, marginBottom: 16, alignSelf: 'flex-start' },
  certText: { fontSize: 11, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  certTextSmall: { fontSize: 10, fontWeight: '800', color: p.neon, marginTop: 4 },
  sellerCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: p.surface, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  sellerName: { fontSize: 16, fontWeight: '900', color: p.text },
  sellerLoc: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  chevron: { fontSize: 24, color: p.textDim },
  prodCard: { flexDirection: 'row', backgroundColor: p.surface, borderRadius: 14, borderWidth: 1, borderColor: p.border, marginBottom: 10, padding: 10 },
  prodImg: { width: 80, height: 80, borderRadius: 10 },
  prodTitle: { fontSize: 15, fontWeight: '800', color: p.text },
  prodPrice: { fontSize: 15, fontWeight: '900', color: p.neon, marginTop: 6 },
  prodStock: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', marginTop: 20 },
  emptyCard: { backgroundColor: p.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 16, width: '100%' },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  totalBox: { marginTop: 16, padding: 16, backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 12, alignItems: 'center' },
  totalLbl: { fontSize: 10, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  totalVal: { fontSize: 26, fontWeight: '900', color: p.text, marginTop: 4 },
  totalSub: { fontSize: 10, color: p.textMuted, marginTop: 4 },
});
