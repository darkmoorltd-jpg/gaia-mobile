import { View, Text, StyleSheet, ScrollView, Pressable, Linking } from 'react-native';
import { Screen, GlassCard, NeonButton, Pill } from '../src/components';
import { useAuth } from '../src/store/auth';
import { typography, spacing, radius, shadows, useTheme } from '../src/theme';
import { usePaymentRefresh } from '../src/utils/paymentRefresh';

interface Plan {
  key: string;
  name: string;
  scans: number;
  price: string;
  tag: string | null;
  url: string;
}

const PLANS: Plan[] = [
  { key: 'starter',    name: 'STARTER',    scans: 150,  price: 'N3,000',  tag: null,         url: 'https://paystack.shop/pay/e-z03btaq-' },
  { key: 'pro',        name: 'PRO',        scans: 300,  price: 'N5,000',  tag: 'POPULAR',    url: 'https://paystack.shop/pay/nc3bs0quuh' },
  { key: 'business',   name: 'BUSINESS',   scans: 1000, price: 'N10,000', tag: null,         url: 'https://paystack.shop/pay/1j9yrapbt4' },
  { key: 'enterprise', name: 'ENTERPRISE', scans: 5000, price: 'N20,000', tag: 'BEST VALUE', url: 'https://paystack.shop/pay/rln87t1694' },
];

export default function BuyScans() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { scansRemaining, plan } = useAuth();
  usePaymentRefresh();

  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Buy Scans</Text>
        <Text style={styles.subtitle}>More scans. More harvests saved.</Text>

        <GlassCard style={{ marginTop: spacing.xl }}>
          <View style={styles.heroRow}>
            <View>
              <Text style={styles.heroLabel}>CURRENT BALANCE</Text>
              <Text style={styles.heroValue}>{scansRemaining}</Text>
              <Text style={styles.heroSub}>scans - {plan.toUpperCase()} plan</Text>
            </View>
            <Pill label="ACTIVE" />
          </View>
        </GlassCard>

        <Text style={styles.sectionLabel}>CHOOSE A PLAN</Text>

        {PLANS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => Linking.openURL(p.url)}
            style={styles.planOuter}
          >
            <View style={[styles.planCard, p.tag !== null && styles.planCardFeatured]}>
              {p.tag !== null && (
                <View style={styles.tag}>
                  <Text style={styles.tagText}>{p.tag}</Text>
                </View>
              )}
              <Text style={styles.planName}>{p.name}</Text>
              <Text style={styles.planScans}>{p.scans.toLocaleString()} scans</Text>
              <Text style={styles.planPrice}>{p.price}</Text>
              <Text style={styles.planPeriod}>per month</Text>
              <NeonButton
                label="SELECT"
                variant={p.tag !== null ? 'primary' : 'ghost'}
                onPress={() => Linking.openURL(p.url)}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          </Pressable>
        ))}

        <Text style={styles.footer}>Secure payment via Paystack</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { ...typography.micro, color: palette.textMuted },
  heroValue: { fontSize: 44, fontWeight: '900', color: palette.neon, letterSpacing: -1.5, marginTop: 4 },
  heroSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md },
  planOuter: { marginBottom: spacing.md },
  planCard: {
    padding: spacing.xl, borderRadius: radius.xl,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    position: 'relative',
  },
  planCardFeatured: { borderColor: palette.borderHi, backgroundColor: palette.neonSoft },
  tag: {
    position: 'absolute', top: -1, right: 20,
    backgroundColor: palette.neon,
    paddingHorizontal: 12, paddingVertical: 4,
    borderBottomLeftRadius: 8, borderBottomRightRadius: 8,
  },
  tagText: { ...typography.micro, color: palette.obsidian, fontWeight: '900' },
  planName: { ...typography.micro, color: palette.textMuted },
  planScans: { fontSize: 26, fontWeight: '900', color: palette.text, marginTop: 6, letterSpacing: -0.8 },
  planPrice: { fontSize: 32, fontWeight: '900', color: palette.neon, marginTop: spacing.sm, letterSpacing: -1 },
  planPeriod: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
  footer: { ...typography.micro, color: palette.textDim, textAlign: 'center', marginTop: spacing.xl },
});
