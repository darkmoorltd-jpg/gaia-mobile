import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, Modal, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { INPUT_CATEGORIES, categoryEmoji } from '../src/data/input_categories';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function InputProviderDashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [products, setProducts] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // Add product form state
  const [name, setName] = useState('');
  const [category, setCategory] = useState(INPUT_CATEGORIES[0]?.key || '');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('kg');
  const [stock, setStock] = useState('');
  const [desc, setDesc] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const [p, o] = await Promise.all([
      supabase.rpc('input_my_products'),
      supabase.rpc('input_provider_orders'),
    ]);
    setProducts(Array.isArray(p.data) ? p.data : []);
    setOrders(Array.isArray(o.data) ? o.data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const addProduct = async () => {
    if (!name || !price || !stock) { Alert.alert('Missing fields'); return; }
    setAdding(true);
    const { error } = await supabase.rpc('input_add_product', {
      p_name: name.trim(),
      p_category: category,
      p_price_ngn: parseFloat(price),
      p_unit: unit,
      p_quantity_available: parseFloat(stock),
      p_description: desc.trim() || null,
    });
    setAdding(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setShowAdd(false); setName(''); setPrice(''); setStock(''); setDesc('');
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>My Input Store</Text>
        <Text style={styles.sub}>Manage your products and orders</Text>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 12 }}>
          <Text style={styles.sectionLabel}>MY PRODUCTS</Text>
          <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <Text style={styles.addBtnText}>+ ADD PRODUCT</Text>
          </Pressable>
        </View>

        {busy ? <ActivityIndicator color="#b388ff" /> : null}
        {!busy && products.length === 0 ? <Text style={styles.empty}>No products listed yet.</Text> : null}

        {products.map(p => (
          <View key={p.id} style={styles.card}>
            <Text style={{ fontSize: 24 }}>{categoryEmoji(p.category)}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{money(p.price_ngn)} / {p.unit} · Stock: {p.quantity_available}</Text>
            </View>
          </View>
        ))}

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RECENT ORDERS</Text>
        {busy ? null : orders.length === 0 ? <Text style={styles.empty}>No orders yet.</Text> : null}
        
        {orders.map(o => (
          <View key={o.id} style={styles.card}>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{o.product_name} × {o.quantity}</Text>
              <Text style={styles.meta}>Buyer: {o.buyer_email}</Text>
              <Text style={[styles.meta, { color: o.status === 'pending' ? '#ffb300' : '#00ff88' }]}>
                Status: {o.status.toUpperCase()}
              </Text>
              <Text style={styles.total}>{money(o.total_ngn)}</Text>
            </View>
          </View>
        ))}

        <View style={{ height: 80 }} />
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalBg}>
          <ScrollView style={styles.modalSheet}>
            <Text style={styles.title}>Add New Product</Text>
            <Text style={styles.label}>PRODUCT NAME</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="e.g. NPK 15-15-15" placeholderTextColor={palette.textDim} />
            
            <Text style={styles.label}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {INPUT_CATEGORIES.map(c => (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipOn]}>
                  <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>PRICE (₦)</Text>
            <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>UNIT (e.g. kg, bag, litre)</Text>
            <TextInput value={unit} onChangeText={setUnit} style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>QUANTITY IN STOCK</Text>
            <TextInput value={stock} onChangeText={setStock} keyboardType="numeric" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={desc} onChangeText={setDesc} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} />

            <Pressable onPress={addProduct} disabled={adding} style={styles.cta}>
              {adding ? <ActivityIndicator color="#000" /> : <Text style={styles.ctaText}>SAVE PRODUCT</Text>}
            </Pressable>
            <Pressable onPress={() => setShowAdd(false)} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: palette.textMuted }}>Cancel</Text>
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff' },
  addBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#b388ff', borderRadius: 8 },
  addBtnText: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1 },
  empty: { fontSize: 12, color: p.textMuted, marginTop: 10, fontStyle: 'italic' },
  card: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 3 },
  total: { fontSize: 16, fontWeight: '900', color: '#b388ff', marginTop: 4 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  modalSheet: { backgroundColor: p.abyss, marginTop: 60, padding: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  cta: { padding: 16, borderRadius: 12, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
