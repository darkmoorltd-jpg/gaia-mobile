import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { INPUT_CATEGORIES, categoryEmoji } from '../src/data/input_categories';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function InputsBrowse() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [products, setProducts] = useState<any[]>([]);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const { data } = await supabase.rpc('input_browse', {
      p_category: category, p_country: null, p_search: search || null, p_limit: 100,
    });
    setProducts(Array.isArray(data) ? data : []);
    setBusy(false); setRef(false);
  }, [category, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Farm Inputs</Text>
        <Text style={styles.sub}>{products.length} product(s) available</Text>

        <TextInput value={search} onChangeText={setSearch}
          placeholder="Search fertilizer, seeds, tools..."
          placeholderTextColor={palette.textDim}
          style={styles.search} autoCapitalize="none" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12, paddingVertical: 8 }}>
          <Pressable onPress={() => setCategory(null)} style={[styles.chip, category === null && styles.chipOn]}>
            <Text style={[styles.chipText, category === null && styles.chipTextOn]}>All</Text>
          </Pressable>
          {INPUT_CATEGORIES.map(c => (
            <Pressable key={c.key} onPress={() => setCategory(c.key)} style={[styles.chip, category === c.key && styles.chipOn]}>
              <Text style={[styles.chipText, category === c.key && styles.chipTextOn]}>{c.emoji} {c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {busy && products.length === 0 ? <ActivityIndicator color="#b388ff" style={{ marginTop: 20 }} /> : null}
        {!busy && products.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No products match your filters.</Text></View>
        ) : null}

        {products.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(('/input-product?id=' + p.id) as any)} style={styles.card}>
            <View style={styles.thumb}><Text style={{ fontSize: 36 }}>{categoryEmoji(p.category)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{p.provider_name} · {p.provider_city || p.provider_state}</Text>
              <Text style={styles.price}>{money(p.price_ngn)} <Text style={styles.unit}>/ {p.unit}</Text></Text>
              <Text style={styles.stock}>{p.quantity_available} {p.unit} in stock</Text>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 12 },
  search: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: 'rgba(179,136,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '900', color: '#b388ff', marginTop: 4 },
  unit: { fontSize: 11, fontWeight: '500', color: p.textMuted },
  stock: { fontSize: 10, color: p.textDim, marginTop: 2 },
});
