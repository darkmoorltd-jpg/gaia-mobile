
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, GlassCard, Pill } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { palette, typography, spacing, radius } from '../../src/theme';

const ITEMS = [
  { icon: '📜', label: 'Scan History',       route: '/history' },
  { icon: '💳', label: 'Payment History',    route: '/payment-history' },
  { icon: '💰', label: 'Wallet',             route: '/wallet' },
  { icon: '🏅', label: 'Badges',             route: '/badges' },
  { icon: '🛡', label: 'Verification',       route: '/verification' },
  { icon: '🌍', label: 'Marketplace',        route: '/marketplace' },
  { icon: '🚨', label: 'Early Warning',      route: '/early-warning' },
  { icon: '🎓', label: 'University',         route: '/university' },
  { icon: '📅', label: 'Farming Calendar',   route: '/calendar' },
  { icon: '🆘', label: 'Help & Support',     route: '/help' },
  { icon: '⚙',  label: 'Settings',           route: '/settings' },
];

export default function Profile() {
  const router = useRouter();
  const { user, scansRemaining, signOut, plan } = useAuth();
  const name = user?.email?.split('@')[0] ?? 'Farmer';

  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name[0]?.toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={{ marginTop: spacing.md }}>
            <Pill label="✓ Verified" />
          </View>
        </View>

        <View style={styles.statRow}>
          <GlassCard style={{ flex: 1 }}>
            <Text style={styles.statVal}>{scansRemaining}</Text>
            <Text style={styles.statLbl}>SCANS</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1 }}>
            <Text style={styles.statVal}>0</Text>
            <Text style={styles.statLbl}>BADGE</Text>
          </GlassCard>
          <GlassCard style={{ flex: 1 }}>
            <Text style={styles.statVal}>{plan[0]?.toUpperCase()}</Text>
            <Text style={styles.statLbl}>PLAN</Text>
          </GlassCard>
        </View>

        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        {ITEMS.map((item, i) => (
          <Pressable
            key={i}
            onPress={() => router.push(item.route as any)}
            style={styles.item}
          >
            <Text style={styles.itemIcon}>{item.icon}</Text>
            <Text style={styles.itemLabel}>{item.label}</Text>
            <Text style={styles.itemChevron}>›</Text>
          </Pressable>
        ))}

        <Pressable
          onPress={() => signOut()}
          style={[styles.item, styles.logout]}
        >
          <Text style={[styles.itemLabel, { color: palette.danger }]}>Log Out</Text>
        </Pressable>

        <Text style={styles.version}>GAIA v1.0.0 · Powered by Darkmoor Ltd</Text>
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  hero: { alignItems: 'center', marginBottom: spacing.xl },
  avatar: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: palette.neonSoft, borderWidth: 2, borderColor: palette.borderHi,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 42, fontWeight: '900', color: palette.neon },
  name: { fontSize: 26, fontWeight: '900', color: palette.text, marginTop: spacing.md, textTransform: 'capitalize', letterSpacing: -0.8 },
  email: { ...typography.body, color: palette.textMuted, marginTop: 4 },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.xl },
  statVal: { fontSize: 24, fontWeight: '900', color: palette.neon, textAlign: 'center', letterSpacing: -0.8 },
  statLbl: { ...typography.micro, color: palette.textMuted, textAlign: 'center', marginTop: 2 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginBottom: spacing.md },
  item: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    padding: spacing.lg, borderRadius: radius.md,
    backgroundColor: palette.surface, marginBottom: spacing.sm,
    borderWidth: 1, borderColor: palette.border,
  },
  itemIcon: { fontSize: 20 },
  itemLabel: { ...typography.body, color: palette.text, fontWeight: '600', flex: 1 },
  itemChevron: { color: palette.textDim, fontSize: 22 },
  logout: { borderColor: palette.danger + '44', justifyContent: 'center' },
  version: { ...typography.micro, color: palette.textDim, textAlign: 'center', marginTop: spacing.xl },
});
