import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { Screen, GlassCard, Pill, StatCard, NeonButton } from '../../src/components';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme/ThemeContext';
import { typography, spacing, radius, shadowsDark } from '../../src/theme';

const FEATURES = [
  { key: 'crops',     icon: '🌿', title: 'Crop Disease',   sub: '6 crops · 60+ diseases', accent: 'crops' },
  { key: 'pests',     icon: '🐛', title: 'Pest Detection', sub: '102 pest classes',       accent: 'pests' },
  { key: 'soil',      icon: '🏞', title: 'Soil Analysis',  sub: '11 soil types',          accent: 'soil' },
  { key: 'livestock', icon: '🐄', title: 'Livestock',      sub: 'Cattle + Poultry',       accent: 'livestock' },
];

export default function Home() {
  const router = useRouter();
  const { user, scansRemaining, plan, refreshScans } = useAuth();
  const { palette, shadows, mode } = useTheme();
  const isLight = mode === 'light';

  const pulse = useSharedValue(1);
  useEffect(() => {
    refreshScans();
    pulse.value = withRepeat(
      withSequence(withTiming(1.05, { duration: 1500 }), withTiming(1, { duration: 1500 })),
      -1, true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const firstName = user?.email?.split('@')[0] ?? 'farmer';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.greeting, { color: palette.textMuted }]}>{greeting},</Text>
              <Text style={[styles.name, { color: palette.text }]}>{firstName}</Text>
            </View>
            <Animated.View style={pulseStyle}>
              <LinearGradient colors={palette.gradientNeon} style={styles.scanBadge}>
                <Text style={[styles.scanNum, { color: isLight ? '#fff' : '#000' }]}>{scansRemaining}</Text>
                <Text style={[styles.scanLbl, { color: isLight ? '#fff' : '#000' }]}>SCANS</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <GlassCard style={{ marginTop: spacing.xl }}>
            <View style={styles.planRow}>
              <View>
                <Text style={[styles.planLabel, { color: palette.textMuted }]}>CURRENT PLAN</Text>
                <Text style={[styles.planValue, { color: palette.neon }]}>{plan.toUpperCase()}</Text>
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

        <Animated.View entering={FadeInDown.delay(200).duration(600)}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>TODAY</Text>
          <View style={styles.statRow}>
            <StatCard value={28} label="TEMP °C" color={palette.neon} />
            <StatCard value="64%" label="HUMIDITY" color={isLight ? '#0091c2' : '#66d9ff'} />
            <StatCard value="🌤" label="CLEAR" color={palette.warning} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={[styles.sectionLabel, { color: palette.textMuted }]}>DIAGNOSE</Text>
          <View style={styles.grid}>
            {FEATURES.map((f) => {
              const accent = (palette as any)[f.accent];
              return (
                <Pressable
                  key={f.key}
                  onPress={() => router.push(`/(tabs)/${f.key}` as any)}
                  style={styles.tileOuter}
                >
                  <View
                    style={[
                      styles.tile,
                      {
                        borderColor: accent + '44',
                        backgroundColor: isLight ? palette.abyss : palette.surface,
                        ...(isLight ? shadows.soft : {}),
                      },
                    ]}
                  >
                    <Text style={styles.tileIcon}>{f.icon}</Text>
                    <Text style={[styles.tileTitle, { color: palette.text }]}>{f.title}</Text>
                    <Text style={[styles.tileSub, { color: palette.textMuted }]}>{f.sub}</Text>
                    <View style={[styles.tileGlow, { backgroundColor: accent }]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 100 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { ...typography.body },
  name: { fontSize: 34, fontWeight: '900', textTransform: 'capitalize', letterSpacing: -1 },
  scanBadge: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: 'center', justifyContent: 'center',
  },
  scanNum: { fontSize: 26, fontWeight: '900' },
  scanLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planLabel: { ...typography.micro },
  planValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5, marginTop: 4 },
  sectionLabel: { ...typography.micro, marginTop: spacing.xxl, marginBottom: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tileOuter: { width: '48%', borderRadius: radius.lg, overflow: 'hidden' },
  tile: {
    padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1,
    minHeight: 140, justifyContent: 'space-between', position: 'relative',
  },
  tileIcon: { fontSize: 32 },
  tileTitle: { fontSize: 15, fontWeight: '800', marginTop: spacing.md, letterSpacing: -0.3 },
  tileSub: { ...typography.micro, marginTop: 2 },
  tileGlow: { position: 'absolute', bottom: 0, right: 0, width: 60, height: 60, borderRadius: 30, opacity: 0.15 },
});
