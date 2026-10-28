import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl, Modal, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { supabase } from '../../src/api/supabase';
import { INPUT_CATEGORIES, categoryEmoji, categoryLabel } from '../../src/data/input_categories';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function ProviderProducts() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [products, setProducts] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('provider_my_products');
    setProducts(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const deleteProduct = (id: string) => {
    Alert.alert('Delete product?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'DELETE', style: 'destructive', onPress: async () => {
        await supabase.from('input_products').delete().eq('id', id);
        load();
      }},
    ]);
  };

  const toggleActive = async (p: any) => {
    await supabase.from('input_products').update({ active: !p.active }).eq('id', p.id);
    load();
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Text style={styles.title}>My Products</Text>
        <Text style={styles.sub}>{products.length} listing(s)</Text>

        <Pressable onPress={() => setShowAdd(true)} style={styles.addBtn}>
          <Text style={styles.addBtnText}>+ ADD NEW PRODUCT</Text>
        </Pressable>

        {busy && products.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {!busy && products.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No products yet</Text>
            <Text style={styles.emptySub}>Tap ADD NEW PRODUCT to list your first input</Text>
          </View>
        ) : null}

        {products.map((p) => (
          <View key={p.id} style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 28 }}>{categoryEmoji(p.category)}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{p.name}</Text>
                <Text style={styles.meta}>{categoryLabel(p.category)}{p.brand ? ' · ' + p.brand : ''}</Text>
              </View>
              <Pressable onPress={() => toggleActive(p)} style={[styles.toggle, { borderColor: p.active ? '#00ff88' : '#64748b' }]}>
                <Text style={[styles.toggleText, { color: p.active ? '#00ff88' : '#64748b' }]}>{p.active ? 'ACTIVE' : 'HIDDEN'}</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <Text style={styles.price}>{money(p.price_ngn)} / {p.unit}</Text>
              <Text style={styles.stock}>{p.quantity_available} {p.unit} in stock</Text>
            </View>
            <Pressable onPress={() => deleteProduct(p.id)} style={{ marginTop: 10 }}>
              <Text style={{ fontSize: 11, color: '#ff3b5c', fontWeight: '700' }}>🗑 Delete</Text>
            </Pressable>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      <AddProductModal visible={showAdd} onClose={() => { setShowAdd(false); load(); }} palette={palette} styles={styles} />
    </View>
  );
}

function AddProductModal({ visible, onClose, palette, styles }: any) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('fertilizer');
  const [brand, setBrand] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('bag');
  const [quantity, setQuantity] = useState('10');
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim() || !price) { Alert.alert('Missing', 'Name and price required'); return; }
    const p = parseFloat(price);
    if (!p || p <= 0) { Alert.alert('Invalid price'); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const { error } = await supabase.from('input_products').insert({
      provider_id: user.id,
      name: name.trim(),
      category,
      brand: brand.trim() || null,
      description: description.trim() || null,
      unit,
      quantity_available: parseFloat(quantity) || 0,
      price_ngn: p,
      active: true,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    setName(''); setBrand(''); setDescription(''); setQuantity('10'); setPrice('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBg}>
        <View style={styles.modalSheet}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <Pressable onPress={onClose}><Text style={styles.back}>CANCEL</Text></Pressable>
            <Text style={styles.title}>Add Product</Text>

            <Text style={styles.label}>NAME *</Text>
            <TextInput value={name} onChangeText={setName} style={styles.input} placeholder="e.g. NPK 20-10-10" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              {INPUT_CATEGORIES.map(c => (
                <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipOn]}>
                  <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>BRAND</Text>
            <TextInput value={brand} onChangeText={setBrand} style={styles.input} placeholder="e.g. Notore" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>UNIT</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              {['bag', 'kg', 'litre', 'bottle', 'pack', 'piece'].map(u => (
                <Pressable key={u} onPress={() => setUnit(u)} style={[styles.chip, unit === u && styles.chipOn]}>
                  <Text style={[styles.chipText, unit === u && styles.chipTextOn]}>{u}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>QUANTITY IN STOCK</Text>
            <TextInput value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>PRICE (₦ per {unit}) *</Text>
            <TextInput value={price} onChangeText={setPrice} keyboardType="decimal-pad" style={styles.input} placeholder="25000" placeholderTextColor={palette.textDim} />

            <Text style={styles.label}>DESCRIPTION</Text>
            <TextInput value={description} onChangeText={setDescription} multiline style={[styles.input, { minHeight: 80 }]} placeholderTextColor={palette.textDim} />

            <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>PUBLISH PRODUCT</Text>}
            </Pressable>

            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  addBtn: { padding: 16, borderRadius: 12, backgroundColor: '#b388ff', alignItems: 'center', marginBottom: 16 },
  addBtnText: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 11, color: p.textMuted, marginTop: 6, textAlign: 'center' },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  toggle: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  toggleText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  price: { fontSize: 16, fontWeight: '900', color: '#b388ff' },
  stock: { fontSize: 11, color: p.textMuted },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: p.abyss, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 14, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  cta: { padding: 18, borderRadius: 14, backgroundColor: '#b388ff', alignItems: 'center', marginTop: 20 },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
