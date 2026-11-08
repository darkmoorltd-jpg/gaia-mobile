import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { categoryEmoji, categoryLabel } from '../src/data/input_categories';

const money = (n: any) => '₦' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });

export default function InputStore() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [provider, setProvider] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({ avg_rating: 0, review_count: 0 });
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [category, setCategory] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!params.id) { setBusy(false); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc('input_store_detail', { p_provider_id: params.id });
    if (!error && data) {
      setProvider(data.provider);
      setProducts(data.products || []);
      setSummary(data.review_summary || { avg_rating: 0, review_count: 0 });
    }
    setBusy(false); setRef(false);
  }, [params.id]);

  useEffect(() => { load(); }, [load]);

  if (busy && !provider) {
    return <View style={styles.container}><ActivityIndicator color="#b388ff" style={{ marginTop: 100 }} /></View>;
  }

  if (!provider) {
    return (
      <View style={styles.container}>
        <Text style={{ color: palette.text, padding: 20 }}>Store not found.</Text>
      </View>
    );
  }

  const categories = Array.from(new Set(products.map(p => p.category)));
  const filtered = category ? products.filter(p => p.category === category) : products;
  const rating = Number(summary.avg_rating || 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#b388ff" />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        {/* STORE HERO */}
        <View style={styles.hero}>
          <View style={styles.storeAvatar}>
            <Text style={styles.storeAvatarText}>{(provider.business_name || 'S').charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.storeName}>{provider.business_name}</Text>
          <Text style={styles.storeLoc}>📍 {provider.city}, {provider.lga}, {provider.state}</Text>

          {summary.review_count > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
              <Text style={{ color: '#ffd700', fontSize: 16 }}>{'★'.repeat(Math.round(rating))}</Text>
              <Text style={{ color: palette.textMuted, fontSize: 12 }}>{rating.toFixed(1)} ({summary.review_count})</Text>
            </View>
          ) : (
            <Text style={{ color: palette.textMuted, fontSize: 12, marginTop: 8 }}>No reviews yet</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            {provider.phone ? (
              <Pressable onPress={() => Linking.openURL('tel:' + provider.phone)} style={[styles.actionBtn, { backgroundColor: 'rgba(179,136,255,0.15)' }]}>
                <Text style={{ color: '#b388ff', fontWeight: '800', fontSize: 11 }}>📞 CALL</Text>
              </Pressable>
            ) : null}
            {provider.whatsapp ? (
              <Pressable onPress={() => Linking.openURL('https://wa.me/' + provider.whatsapp.replace(/\D/g, ''))} style={[styles.actionBtn, { backgroundColor: 'rgba(37,211,102,0.15)' }]}>
                <Text style={{ color: '#25d366', fontWeight: '800', fontSize: 11 }}>💬 WHATSAPP</Text>
              </Pressable>
            ) : null}
            {provider.gps_lat && provider.gps_lon ? (
              <Pressable
                onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${provider.gps_lat},${provider.gps_lon}`)}
                style={[styles.actionBtn, { backgroundColor: 'rgba(255,179,0,0.15)' }]}
              >
                <Text style={{ color: '#ffb300', fontWeight: '800', fontSize: 11 }}>📍 MAP</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* STORE PHOTOS */}
        {provider.store_images && provider.store_images.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>STORE PHOTOS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {provider.store_images.map((img: string, i: number) => (
                <Pressable key={i} onPress={() => Linking.openURL(img)}>
                  <Image source={{ uri: img }} style={{ width: 160, height: 110, borderRadius: 12 }} />
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* CATEGORY FILTER */}
        {categories.length > 1 ? (
          <>
            <Text style={styles.sectionLabel}>SHOP BY CATEGORY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 12 }}>
              <Pressable onPress={() => setCategory(null)} style={[styles.chip, category === null && styles.chipOn]}>
                <Text style={[styles.chipText, category === null && styles.chipTextOn]}>All ({products.length})</Text>
              </Pressable>
              {categories.map((c: any) => (
                <Pressable key={c} onPress={() => setCategory(c)} style={[styles.chip, category === c && styles.chipOn]}>
                  <Text style={[styles.chipText, category === c && styles.chipTextOn]}>
                    {categoryEmoji(c)} {categoryLabel(c)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* PRODUCTS */}
        <Text style={styles.sectionLabel}>PRODUCTS ({filtered.length})</Text>
        {filtered.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyText}>No products in this category.</Text></View>
        ) : null}

        {filtered.map((p) => (
          <Pressable key={p.id} onPress={() => router.push(('/input-product?id=' + p.id) as any)} style={styles.card}>
            <View style={styles.thumb}><Text style={{ fontSize: 32 }}>{categoryEmoji(p.category)}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{p.name}</Text>
              <Text style={styles.meta}>{categoryLabel(p.category)}{p.brand ? ' · ' + p.brand : ''}</Text>
              <Text style={styles.price}>{money(p.price_ngn)} <Text style={styles.unit}>/ {p.unit}</Text></Text>
              <Text style={styles.stock}>{p.quantity_available} {p.unit} in stock</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
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
  hero: { alignItems: 'center', marginVertical: 20 },
  storeAvatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: 'rgba(179,136,255,0.15)', borderWidth: 2, borderColor: '#b388ff', alignItems: 'center', justifyContent: 'center' },
  storeAvatarText: { fontSize: 36, fontWeight: '900', color: '#b388ff' },
  storeName: { fontSize: 24, fontWeight: '900', color: p.text, marginTop: 12, textAlign: 'center' },
  storeLoc: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#b388ff', marginTop: 24, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: '#b388ff', backgroundColor: 'rgba(179,136,255,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: '#b388ff' },
  empty: { padding: 24, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  emptyText: { fontSize: 12, color: p.textMuted },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  thumb: { width: 60, height: 60, borderRadius: 12, backgroundColor: 'rgba(179,136,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  price: { fontSize: 16, fontWeight: '900', color: '#b388ff', marginTop: 4 },
  unit: { fontSize: 11, fontWeight: '500', color: p.textMuted },
  stock: { fontSize: 10, color: p.textDim, marginTop: 2 },
  chevron: { fontSize: 22, color: p.textDim },
});
