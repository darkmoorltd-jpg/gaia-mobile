import { useCallback, useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { fetchListings, isVerifiedSeller, CATEGORIES, naira, Listing } from '../src/utils/marketplace';
import { supabase } from '../src/api/supabase';

const { width } = Dimensions.get('window');
const CARD_W = (width - 42) / 2;

export default function MarketplaceHome() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const styles = createStyles(palette);
  
  const [cat, setCat] = useState('All');
  const [listings, setListings] = useState<Listing[]>([]);
  const [featuredStores, setFeaturedStores] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest'|'low'|'high'>('newest');

  const load = useCallback(async () => {
    setBusy(true);
    const rows = await fetchListings(cat);
    setListings(rows);
    
    // Fetch trending stores
    const { data: stores } = await supabase.from('marketplace_stores').select('*').eq('status', 'active').limit(10);
    setFeaturedStores(stores || []);
    
    setBusy(false);
  }, [cat]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    let result = search.trim()
      ? listings.filter((l) => l.title.toLowerCase().includes(search.toLowerCase()) || (l.location || '').toLowerCase().includes(search.toLowerCase()))
      : listings;
      
    if (sort === 'low') result = [...result].sort((a, b) => a.price - b.price);
    else if (sort === 'high') result = [...result].sort((a, b) => b.price - a.price);
    
    return result;
  }, [listings, search, sort]);

  const goSell = () => {
    router.push('/marketplace-store' as any);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.brand}>GAIA Market</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Pressable onPress={() => router.push('/marketplace-orders' as any)} style={styles.iconBtn}><Text style={styles.iconTxt}>O</Text></Pressable>
            <Pressable onPress={() => router.push('/marketplace-cart' as any)} style={styles.iconBtn}><Text style={styles.iconTxt}>C</Text></Pressable>
            <Pressable onPress={goSell} style={styles.sellBtn}><Text style={styles.sellTxt}>SELL</Text></Pressable>
          </View>
        </View>
        <View style={styles.search}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="Search produce, seeds..." placeholderTextColor={palette.textDim} style={styles.searchInput} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={busy} onRefresh={load} tintColor={palette.neon} />}>
        <Pressable onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)/profile' as any); }} style={{ padding: 16, paddingBottom: 0 }} hitSlop={10}>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.5, color: palette.neon }}>{'<'} BACK</Text>
        </Pressable>

        {/* Trending Stores Carousel */}
        {featuredStores.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>FEATURED STORES</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingLeft: 16, marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {featuredStores.map((s, i) => (
                  <Pressable key={i} style={styles.storeCard} onPress={() => {}}>
                    <Image source={{ uri: (s.images && s.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=200' }} style={{ width: '100%', height: 80 }} />
                    <View style={{ padding: 10 }}>
                      <Text style={{ fontWeight: '800', color: palette.text, fontSize: 13 }} numberOfLines={1}>{s.store_name}</Text>
                      <Text style={{ color: palette.neon, fontSize: 10, marginTop: 2 }}>✓ Verified Store</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        ) : null}

        <Text style={styles.sectionLabel}>CATEGORIES</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 }}>
          <Text style={styles.sectionLabel}>{cat === 'All' ? 'ALL LISTINGS' : cat.toUpperCase()}</Text>
          
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {(['newest', 'low', 'high'] as const).map(s => (
              <Pressable key={s} onPress={() => setSort(s)} style={[styles.sortBtn, sort === s && styles.sortActive]}>
                <Text style={[styles.sortTxt, sort === s && { color: '#000' }]}>{s === 'newest' ? 'New' : s === 'low' ? '₦↑' : '₦↓'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {busy && listings.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginVertical: 30 }} /> : null}
        {!busy && filtered.length === 0 ? <Text style={styles.empty}>No listings yet.</Text> : null}

        <View style={styles.grid}>
          {filtered.map((l) => (
            <Pressable key={l.id} onPress={() => router.push({ pathname: '/marketplace-product', params: { id: String(l.id) } } as any)} style={styles.card}>
              <Image source={{ uri: (l.images && l.images[0]) || 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600' }} style={styles.cardImg} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{l.title}</Text>
                <Text style={styles.cardPrice}>{naira(l.price)}</Text>
                <Text style={styles.cardUnit}>{l.unit}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.rating}>★ {l.rating ? l.rating.toFixed(1) : '4.5'}</Text>
                  <Text style={styles.loc} numberOfLines={1}>{l.location || 'Nigeria'}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  header: { paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, backgroundColor: p.obsidian, borderBottomWidth: 1, borderBottomColor: p.border },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center', justifyContent: 'center' },
  iconTxt: { fontSize: 14, fontWeight: '900', color: p.neon },
  sellBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: p.neon },
  sellTxt: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: p.border },
  searchIcon: { fontSize: 14, fontWeight: '900', color: p.neon },
  searchInput: { flex: 1, paddingVertical: 12, color: p.text, fontSize: 14 },
  scroll: { paddingBottom: 40 },
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 10, paddingHorizontal: 16 },
  storeCard: { width: 140, borderRadius: 12, backgroundColor: p.surface, overflow: 'hidden', borderWidth: 1, borderColor: p.border },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  chipTextActive: { color: p.obsidian },
  sortBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.border },
  sortActive: { backgroundColor: p.neon, borderColor: p.neon },
  sortTxt: { fontSize: 10, fontWeight: '800', color: p.textMuted },
  empty: { fontSize: 14, color: p.textMuted, textAlign: 'center', paddingVertical: 30 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16, marginTop: 10 },
  card: { width: CARD_W, backgroundColor: p.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: p.border },
  cardImg: { width: '100%', height: 130 },
  cardBody: { padding: 10 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: p.text, minHeight: 34 },
  cardPrice: { fontSize: 16, fontWeight: '900', color: p.neon, marginTop: 4 },
  cardUnit: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  rating: { fontSize: 11, color: p.warning, fontWeight: '700' },
  loc: { fontSize: 11, color: p.textMuted, maxWidth: '55%' },
});
