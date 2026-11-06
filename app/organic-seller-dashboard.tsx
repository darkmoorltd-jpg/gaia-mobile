import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function OrganicSellerDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const styles = createStyles(palette);

  const [seller, setSeller] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);

  // Add product modal
  const [showAdd, setShowAdd] = useState(false);
  const [pTitle, setPTitle] = useState('');
  const [pPrice, setPPrice] = useState('');
  const [pStock, setPStock] = useState('');
  const [pUnit, setPUnit] = useState('kg');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    
    // Get seller profile
    const { data: s } = await supabase.from('organic_sellers').select('*').eq('user_id', user.id).maybeSingle();
    setSeller(s);

    if (s) {
      // Get products
      const { data: p } = await supabase.from('organic_products').select('*').eq('seller_id', s.id).order('created_at', { ascending: false });
      setProducts(p || []);

      // Get orders
      const { data: o } = await supabase.from('organic_orders').select('*, organic_products(title)').eq('seller_id', s.id).order('created_at', { ascending: false });
      setOrders(o || []);
    }
    setBusy(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addProduct = async () => {
    if (!pTitle.trim() || !pPrice || !pStock) { Alert.alert('Missing fields'); return; }
    setAdding(true);

    const { error } = await supabase.from('organic_products').insert({
      seller_id: seller.id,
      title: pTitle.trim(),
      price: parseFloat(pPrice),
      stock_quantity: parseFloat(pStock),
      unit: pUnit,
      is_organic: true,
    });

    setAdding(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setShowAdd(false);
    setPTitle(''); setPPrice(''); setPStock('');
    load();
  };

  if (busy) return <View style={styles.container}><ActivityIndicator color={palette.neon} style={{ marginTop: 100 }} /></View>;

  if (!seller) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Organic Seller</Text>
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>You haven't registered as an organic seller yet.</Text>
            <Pressable onPress={() => router.push('/organic-seller-register' as any)} style={styles.cta}>
              <Text style={styles.ctaText}>REGISTER NOW</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  const pendingOrders = orders.filter(o => o.status === 'escrow');
  const completedOrders = orders.filter(o => o.status === 'completed');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + Number(o.seller_payout), 0);
  const escrowAmount = pendingOrders.reduce((sum, o) => sum + Number(o.seller_payout), 0);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>{seller.business_name}</Text>
        <Text style={styles.sub}>Tier: {seller.tier_id.toUpperCase()} · {seller.is_certified ? '✅ Certified' : 'Not Certified'}</Text>

        <View style={styles.statRow}>
          <View style={styles.stat}><Text style={styles.statVal}>{products.length}</Text><Text style={styles.statLbl}>PRODUCTS</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>{pendingOrders.length}</Text><Text style={styles.statLbl}>IN ESCROW</Text></View>
          <View style={styles.stat}><Text style={styles.statVal}>₦{totalRevenue.toLocaleString()}</Text><Text style={styles.statLbl}>EARNED</Text></View>
        </View>

        {escrowAmount > 0 && (
          <View style={styles.escrowBox}>
            <Text style={styles.escrowLabel}>⏳ ₦{escrowAmount.toLocaleString()} IN ESCROW</Text>
            <Text style={styles.escrowSub}>Funds release automatically 3 days after buyer confirms delivery.</Text>
          </View>
        )}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 10 }}>
          <Text style={styles.sectionLabel}>MY PRODUCTS</Text>
          <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ ADD PRODUCT</Text>
          </Pressable>
        </View>

        {products.length === 0 ? <Text style={styles.emptyText}>No products yet.</Text> : null}
        {products.map(p => (
          <View key={p.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prodTitle}>{p.title}</Text>
              <Text style={styles.prodPrice}>₦{Number(p.price).toLocaleString()} / {p.unit}</Text>
              <Text style={styles.prodStock}>Stock: {p.stock_quantity} {p.unit}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT ORDERS</Text>
        {orders.length === 0 ? <Text style={styles.emptyText}>No orders yet.</Text> : null}
        {orders.slice(0, 10).map(o => (
          <View key={o.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prodTitle}>{o.organic_products?.title || 'Product'} × {o.quantity}</Text>
              <Text style={styles.prodPrice}>Earned: ₦{Number(o.seller_payout).toLocaleString()}</Text>
              <Text style={[styles.prodStock, { color: o.status === 'escrow' ? '#ffb300' : palette.neon }]}>
                {o.status === 'escrow' ? '⏳ In Escrow (3-day release)' : '✅ Completed'}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalSheet}>
            <Text style={styles.title}>Add Product</Text>
            <Text style={styles.label}>PRODUCT NAME</Text>
            <TextInput value={pTitle} onChangeText={setPTitle} style={styles.input} placeholderTextColor={palette.textDim} placeholder="e.g. Organic Tomatoes" />
            <Text style={styles.label}>PRICE (₦)</Text>
            <TextInput value={pPrice} onChangeText={setPPrice} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>STOCK</Text>
            <TextInput value={pStock} onChangeText={setPStock} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />
            <Text style={styles.label}>UNIT</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {['kg', 'bag', 'bunch', 'tonne'].map(u => (
                <Pressable key={u} onPress={() => setPUnit(u)} style={[styles.chip, pUnit === u && styles.chipOn]}>
                  <Text style={[styles.chipText, pUnit === u && styles.chipTextOn]}>{u}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={addProduct} disabled={adding} style={styles.cta}>
              {adding ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>SAVE PRODUCT</Text>}
            </Pressable>
            <Pressable onPress={() => setShowAdd(false)} style={{ marginTop: 16, alignItems: 'center' }}>
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
  title: { fontSize: 26, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: p.surface, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: p.border },
  statVal: { fontSize: 18, fontWeight: '900', color: p.neon },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, marginTop: 4, letterSpacing: 0.5 },
  escrowBox: { backgroundColor: 'rgba(255,179,0,0.1)', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)' },
  escrowLabel: { fontSize: 13, fontWeight: '900', color: '#ffb300' },
  escrowSub: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: p.neon, borderRadius: 8 },
  addBtnText: { fontSize: 10, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { flexDirection: 'row', backgroundColor: p.surface, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  prodTitle: { fontSize: 14, fontWeight: '800', color: p.text },
  prodPrice: { fontSize: 13, color: p.text, marginTop: 4, fontWeight: '600' },
  prodStock: { fontSize: 11, color: p.textMuted, marginTop: 4 },
  emptyCard: { backgroundColor: p.surface, padding: 24, borderRadius: 16, borderWidth: 1, borderColor: p.border, alignItems: 'center', marginTop: 20 },
  emptyText: { fontSize: 13, color: p.textMuted, textAlign: 'center', lineHeight: 20, marginTop: 12 },
  cta: { padding: 16, borderRadius: 12, backgroundColor: p.neon, alignItems: 'center', marginTop: 16, width: '100%' },
  ctaText: { fontSize: 13, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
  modalSheet: { backgroundColor: p.abyss, padding: 24, borderRadius: 20 },
  label: { fontSize: 10, fontWeight: '800', color: p.textMuted, marginTop: 16, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text },
  chip: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
});
