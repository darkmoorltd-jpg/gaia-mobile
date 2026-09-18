
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, GlassCard, NeonButton } from '../src/components';
import { typography, spacing, radius, shadows } from '../src/theme';
import { useTheme } from '../src/theme';

const TXNS = [
  { icon: '➕', label: 'Pro Plan Purchase', sub: 'Today · 10:24 AM', amt: '+300 scans', positive: true },
  { icon: '➖', label: 'Withdrawal to GTBank', sub: 'Yesterday · 4:00 PM', amt: '-₦10,000', positive: false },
  { icon: '🏅', label: 'Gold Badge', sub: '3 days ago', amt: '−₦3,000', positive: false },
  { icon: '➕', label: 'Marketplace sale', sub: '5 days ago', amt: '+₦45,000', positive: true },
];

export default function Wallet() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Wallet</Text>
        <Text style={styles.subtitle}>Your money, secured.</Text>

        <LinearGradient
          colors={palette.gradientNeon as any}
          style={styles.balanceCard}
        >
          <Text style={styles.balanceLabel}>AVAILABLE BALANCE</Text>
          <Text style={styles.balanceValue}>₦ 12,450.00</Text>
          <View style={styles.balanceDivider} />
          <Text style={styles.balanceSub}>GAIA-8A3C-4F21 · Wema Bank</Text>
        </LinearGradient>

        <View style={styles.actionRow}>
          <View style={{ flex: 1 }}>
            <NeonButton label="⬆ TOP UP" onPress={() => {}} />
          </View>
          <View style={{ flex: 1 }}>
            <NeonButton label="⬇ WITHDRAW" variant="ghost" onPress={() => {}} />
          </View>
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <Text style={styles.escrowLabel}>IN ESCROW</Text>
          <Text style={styles.escrowValue}>₦ 2,500.00</Text>
        </GlassCard>

        <Text style={styles.sectionLabel}>RECENT ACTIVITY</Text>

        {TXNS.map((t, i) => (
          <Pressable key={i} style={{ marginBottom: spacing.sm }}>
            <GlassCard>
              <View style={styles.txnRow}>
                <Text style={styles.txnIcon}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnLabel}>{t.label}</Text>
                  <Text style={styles.txnSub}>{t.sub}</Text>
                </View>
                <Text style={[styles.txnAmt, { color: t.positive ? palette.neon : palette.text }]}>
                  {t.amt}
                </Text>
              </View>
            </GlassCard>
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
  balanceCard: {
    borderRadius: radius.xl, padding: spacing.xxl, marginTop: spacing.xl, ...shadows.neon,
  },
  balanceLabel: { ...typography.micro, color: 'rgba(0,0,0,0.7)' },
  balanceValue: { fontSize: 40, fontWeight: '900', color: '#000', marginTop: 8, letterSpacing: -1.5 },
  balanceDivider: { height: 1, backgroundColor: 'rgba(0,0,0,0.15)', marginVertical: spacing.lg },
  balanceSub: { ...typography.caption, color: 'rgba(0,0,0,0.7)', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  escrowLabel: { ...typography.micro, color: palette.textMuted },
  escrowValue: { fontSize: 24, fontWeight: '900', color: palette.warning, marginTop: 4 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginVertical: spacing.lg },
  txnRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  txnIcon: { fontSize: 24 },
  txnLabel: { ...typography.body, color: palette.text, fontWeight: '600' },
  txnSub: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
  txnAmt: { fontWeight: '800', fontSize: 14 },
});
