
import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Screen, GlassCard, Pill, StatCard, NeonButton } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { palette, typography, spacing, radius, shadows } from '../../src/theme';

const FEATURES = [
  { key: 'crops',     icon: '🌿', title: 'Crop Disease',   sub: '6 crops · 60+ diseases', color: palette.crops },
  { key: 'pests',     icon: '🐛', title: 'Pest Detection', sub: '102 pest classes',       color: palette.pests },
  { key: 'soil',      icon: '🏞', title: 'Soil Analysis',  sub: '11 soil types',          color: palette.soil },
  { key: 'livestock', icon: '🐄', title: 'Livestock',      sub: 'Cattle + Poultry',       color: palette.livestock },
];

export default function Home() {
  const router = useRouter();
  const { user, scansRemaining, plan, refreshScans } = useAuth();

  const pulse = useSharedValue(1);
  useEffect(() => {
    refreshScans();
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1, true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const firstName = user?.email?.split('@')[0] ?? 'farmer';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen glow="crops">
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>{firstName}</Text>
            </View>
            <Animated.View style={pulseStyle}>
              <LinearGradient
                colors={palette.gradientNeon as any}
                style={styles.scanBadge}
              >
                <Text style={styles.scanNum}>{scansRemaining}</Text>
                <Text style={styles.scanLbl}>SCANS</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        {/* Plan card */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <GlassCard style={{ marginTop: spacing.xl }}>
            <View style={styles.planRow}>
              <View>
                <Text style={styles.planLabel}>CURRENT PLAN</Text>
                <Text style={styles.planValue}>{plan.toUpperCase()}</Text>
              </View>
              <Pill label="Active" />
            </View>
            <NeonButton
              label="UPGRADE SCANS"
              variant="ghost"
              onPress={() => router.push('/buy-scans' as any)}
              style={{ marginTop: spacing.lg }}
            />
          </GlassCard>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={styles.sectionLabel}>TODAY</Text>
          <View style={styles.statRow}>
            <StatCard value={28} label="TEMP °C" color={palette.neon} />
            <StatCard value="64%" label="HUMIDITY" color="#66d9ff" />
            <StatCard value="🌤" label="CLEAR" color={palette.warning} />
          </View>
        </Animated.View>

        {/* Diagnose section */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={styles.sectionLabel}>DIAGNOSE</Text>
          <View style={styles.grid}>
            {FEATURES.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => router.push(`/(tabs)/${f.key}` as any)}
                style={styles.tileOuter}
              >
                <LinearGradient
                  colors={[palette.surface, 'rgba(0,0,0,0.2)']}
                  style={[styles.tile, { borderColor: f.color + '44' }]}
                >
                  <Text style={styles.tileIcon}>{f.icon}</Text>
                  <Text style={styles.tileTitle}>{f.title}</Text>
                  <Text style={styles.tileSub}>{f.sub}</Text>
                  <View style={[styles.tileGlow, { backgroundColor: f.color }]} />
                </LinearGradient>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Recent activity */}
        <Animated.View entering={FadeInDown.delay(400).duration(600)}>
          <Text style={styles.sectionLabel}>RECENT</Text>
          <GlassCard style={{ marginBottom: spacing.md }}>
            <View style={styles.recentRow}>
              <Text style={styles.recentIcon}>🌽</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>Maize · Blight</Text>
                <Text style={styles.recentSub}>2 hours ago</Text>
              </View>
              <Text style={styles.recentScore}>89%</Text>
            </View>
          </GlassCard>
          <GlassCard>
            <View style={styles.recentRow}>
              <Text style={styles.recentIcon}>🐛</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.recentTitle}>Aphids</Text>
                <Text style={styles.recentSub}>Yesterday</Text>
              </View>
              <Text style={styles.recentScore}>91%</Text>
            </View>
          </GlassCard>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 100 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: { ...typography.body, color: palette.textMuted },
  name: {
    fontSize: 34,
    fontWeight: '900',
    color: palette.text,
    textTransform: 'capitalize',
    letterSpacing: -1,
  },
  scanBadge: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.neon,
  },
  scanNum: { fontSize: 26, fontWeight: '900', color: '#000' },
  scanLbl: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  planRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planLabel: { ...typography.micro, color: palette.textMuted },
  planValue: {
    fontSize: 24,
    fontWeight: '900',
    color: palette.neon,
    letterSpacing: -0.5,
    marginTop: 4,
  },
  sectionLabel: {
    ...typography.micro,
    color: palette.textMuted,
    marginTop: spacing.xxl,
    marginBottom: spacing.md,
  },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileOuter: {
    width: '48%',
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  tile: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 140,
    justifyContent: 'space-between',
    position: 'relative',
  },
  tileIcon: { fontSize: 32 },
  tileTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: palette.text,
    marginTop: spacing.md,
    letterSpacing: -0.3,
  },
  tileSub: {
    ...typography.micro,
    color: palette.textMuted,
    marginTop: 2,
  },
  tileGlow: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 60,
    height: 60,
    borderRadius: 30,
    opacity: 0.15,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  recentIcon: { fontSize: 28 },
  recentTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  recentSub: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
  recentScore: {
    fontSize: 18,
    fontWeight: '900',
    color: palette.neon,
  },
});
