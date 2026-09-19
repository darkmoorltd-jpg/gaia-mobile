import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, GlassCard, NeonButton } from '../src/components';
import { typography, spacing, radius, shadows } from '../src/theme';
import { useTheme } from '../src/theme';
import { usePaymentRefresh } from '../src/utils/paymentRefresh';

const BADGES = [
  { key: 'bronze',   name: 'BRONZE',   emoji: '🥉', price: '₦500/mo',  loan: 'Up to ₦50,000',   colors: ['#7a5230', '#c68a5c'] },
  { key: 'silver',   name: 'SILVER',   emoji: '🥈', price: '₦1,500/mo', loan: 'Up to ₦200,000',  colors: ['#4a5459', '#b0bec5'] },
  { key: 'gold',     name: 'GOLD',     emoji: '🥇', price: '₦3,000/mo', loan: 'Up to ₦500,000',  colors: ['#8a6900', '#ffd700'] },
  { key: 'platinum', name: 'PLATINUM', emoji: '💎', price: '₦5,000/mo', loan: 'Up to ₦2,000,000', colors: ['#3a3540', '#e5e4e2'] },
];

export default function Badges() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  usePaymentRefresh();
  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Badges</Text>
        <Text style={styles.subtitle}>Unlock loans, insurance, and more.</Text>

        <LinearGradient colors={['#8a6900', '#ffd700'] as any} style={styles.currentBadge}>
          <Text style={styles.currentEmoji}>🥇</Text>
          <Text style={styles.currentName}>GOLD</Text>
          <Text style={styles.currentSub}>Expires in 23 days</Text>
        </LinearGradient>

        <Text style={styles.sectionLabel}>UPGRADE</Text>

        {BADGES.map((b) => (
          <Pressable key={b.key} style={{ marginBottom: spacing.md }}>
            <View style={styles.badgeRow}>
              <LinearGradient colors={b.colors as any} style={styles.badgeIconWrap}>
                <Text style={styles.badgeEmoji}>{b.emoji}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.badgeName}>{b.name}</Text>
                <Text style={styles.badgeLoan}>{b.loan}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.badgePrice}>{b.price}</Text>
                <NeonButton label="SELECT" variant="ghost" onPress={() => Linking.openURL("https://paystack.shop/pay/gaia-badges")} style={{ marginTop: 6, paddingVertical: 8, paddingHorizontal: 16, minHeight: 36 }} />
              </View>
            </View>
          </Pressable>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  currentBadge: {
    borderRadius: radius.xl, padding: spacing.xxl, marginTop: spacing.xl,
    alignItems: 'center', ...shadows.neon,
  },
  currentEmoji: { fontSize: 64 },
  currentName: { fontSize: 36, fontWeight: '900', color: '#000', letterSpacing: 4, marginTop: 8 },
  currentSub: { ...typography.micro, color: 'rgba(0,0,0,0.7)', marginTop: 8 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.lg },
  badgeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
  },
  badgeIconWrap: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
  },
  badgeEmoji: { fontSize: 28 },
  badgeName: { ...typography.body, color: palette.text, fontWeight: '800', letterSpacing: 1 },
  badgeLoan: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  badgePrice: { ...typography.caption, color: palette.neon, fontWeight: '800' },
});
