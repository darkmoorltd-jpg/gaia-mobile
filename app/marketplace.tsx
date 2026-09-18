import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image, Dimensions } from 'react-native';
import { useTheme, spacing, radius } from '../src/theme';

const { width } = Dimensions.get('window');

const CATEGORIES = ['All', 'Maize', 'Rice', 'Tomato', 'Pepper', 'Beans', 'Cassava'];

const LISTINGS = [
  { title: 'Yellow Maize - Grade A', price: 45000, unit: 'per ton', location: 'Kaduna', rating: 4.8, img: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?w=600' },
  { title: 'Fresh Tomatoes', price: 25000, unit: 'per basket', location: 'Lagos', rating: 4.9, img: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=600' },
  { title: 'Red Pepper - Dried', price: 15000, unit: 'per basket', location: 'Oyo', rating: 4.7, img: 'https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=600' },
  { title: 'Cassava Tubers', price: 18000, unit: 'per 100kg', location: 'Ogun', rating: 4.6, img: 'https://images.unsplash.com/photo-1595348020949-87cdfbb44174?w=600' },
  { title: 'Local Rice - Ofada', price: 85000, unit: 'per bag', location: 'Ebonyi', rating: 4.8, img: 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600' },
  { title: 'Brown Beans', price: 55000, unit: 'per bag', location: 'Kano', rating: 4.9, img: 'https://images.unsplash.com/photo-1610970881699-44a5587cabec?w=600' },
];

export default function Marketplace() {
  const { palette } = useTheme();
  const [cat, setCat] = useState('All');
  const styles = createStyles(palette);

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>GAIA Market</Text>
        <View style={styles.search}>
          <Text style={styles.searchIcon}>S</Text>
          <TextInput placeholder="Search fresh produce" placeholderTextColor={palette.textDim} style={styles.searchInput} />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16 }}>
            {CATEGORIES.map((c) => (
              <Pressable key={c} onPress={() => setCat(c)} style={[styles.chip, cat === c && styles.chipActive]}>
                <Text style={[styles.chipText, cat === c && styles.chipTextActive]}>{c}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={styles.grid}>
          {LISTINGS.map((l, i) => (
            <Pressable key={i} style={styles.card}>
              <Image source={{ uri: l.img }} style={styles.cardImg} />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>{l.title}</Text>
                <Text style={styles.cardPrice}>N{l.price.toLocaleString()}</Text>
                <Text style={styles.cardUnit}>{l.unit}</Text>
                <View style={styles.cardMeta}>
                  <Text style={styles.cardRating}>★ {l.rating}</Text>
                  <Text style={styles.cardLoc}>{l.location}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  topBar: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 12 },
  brand: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -0.8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, backgroundColor: p.surface, borderRadius: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: p.border },
  searchIcon: { fontSize: 14, fontWeight: '900', color: p.neon },
  searchInput: { flex: 1, paddingVertical: 12, color: p.text, fontSize: 14 },
  scroll: { paddingBottom: 40 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon },
  chipText: { fontSize: 12, fontWeight: '700', color: p.textMuted },
  chipTextActive: { color: p.obsidian },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 16 },
  card: { width: (width - 42) / 2, backgroundColor: p.surface, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: p.border },
  cardImg: { width: '100%', height: 140 },
  cardBody: { padding: 12 },
  cardTitle: { fontSize: 13, fontWeight: '700', color: p.text, minHeight: 34 },
  cardPrice: { fontSize: 17, fontWeight: '900', color: p.neon, marginTop: 6 },
  cardUnit: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  cardRating: { fontSize: 11, color: p.warning, fontWeight: '700' },
  cardLoc: { fontSize: 11, color: p.textMuted },
});
