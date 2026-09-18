
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { Screen, GlassCard, Pill } from '../src/components';
import { typography, spacing, radius } from '../src/theme';
import { useTheme } from '../src/theme';

const LISTINGS = [
  { emoji: '🌽', title: 'Yellow Maize', price: '₦45,000/ton', rating: 4.8, location: 'Kaduna' },
  { emoji: '🍅', title: 'Fresh Tomatoes', price: '₦25,000/basket', rating: 4.9, location: 'Lagos' },
  { emoji: '🌶', title: 'Red Pepper', price: '₦15,000/basket', rating: 4.7, location: 'Oyo' },
  { emoji: '🥔', title: 'Cassava Tubers', price: '₦18,000/100kg', rating: 4.6, location: 'Ogun' },
  { emoji: '🌾', title: 'Local Rice', price: '₦85,000/bag', rating: 4.8, location: 'Ebonyi' },
  { emoji: '🫘', title: 'Brown Beans', price: '₦55,000/bag', rating: 4.9, location: 'Kano' },
];

export default function Marketplace() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Pill label="Marketplace" />
            <Text style={styles.title}>Buy & Sell</Text>
          </View>
          <Text style={styles.cartIcon}>🛒</Text>
        </View>

        <View style={styles.search}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            placeholder="Search produce…"
            placeholderTextColor={palette.textDim}
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {['All', 'Maize', 'Rice', 'Tomato', 'Pepper', 'Beans'].map((c, i) => (
              <View key={i} style={[styles.chip, i === 0 && styles.chipActive]}>
                <Text style={[styles.chipText, i === 0 && styles.chipTextActive]}>{c}</Text>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={styles.grid}>
          {LISTINGS.map((l, i) => (
            <View key={i} style={styles.tile}>
              <View style={styles.imgWrap}>
                <Text style={styles.img}>{l.emoji}</Text>
              </View>
              <Text style={styles.tileTitle}>{l.title}</Text>
              <Text style={styles.tilePrice}>{l.price}</Text>
              <View style={styles.meta}>
                <Text style={styles.metaText}>⭐ {l.rating}</Text>
                <Text style={styles.metaText}>📍 {l.location}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm },
  cartIcon: { fontSize: 28 },
  search: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, marginTop: spacing.lg,
  },
  searchIcon: { fontSize: 16 },
  searchInput: { flex: 1, color: palette.text, paddingVertical: spacing.md, fontSize: 15 },
  chip: { paddingHorizontal: spacing.lg, paddingVertical: 8, borderRadius: 20, backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border },
  chipActive: { backgroundColor: palette.neonSoft, borderColor: palette.borderHi },
  chipText: { ...typography.micro, color: palette.textMuted },
  chipTextActive: { color: palette.neon },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.lg },
  tile: {
    width: '48%', backgroundColor: palette.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: palette.border,
  },
  imgWrap: { aspectRatio: 1, borderRadius: radius.md, backgroundColor: palette.abyss, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md },
  img: { fontSize: 64 },
  tileTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  tilePrice: { ...typography.caption, color: palette.neon, fontWeight: '800', marginTop: 4 },
  meta: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
  metaText: { ...typography.micro, color: palette.textMuted },
});
