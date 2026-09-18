import { useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTheme, typography, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const FEATURES = [
  { key: 'crops',     letter: 'C', title: 'Crop Disease',   sub: '6 crops - 60+ diseases' },
  { key: 'pests',     letter: 'P', title: 'Pest Detection', sub: '102 pest classes' },
  { key: 'soil',      letter: 'S', title: 'Soil Analysis',  sub: '11 soil types' },
  { key: 'livestock', letter: 'L', title: 'Livestock',      sub: 'Cattle + Poultry' },
];

export default function Home() {
  const router = useRouter();
  const { palette } = useTheme();
  const { scansRemaining, plan, refreshScans } = useAuth();
  const styles = createStyles(palette);

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

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name}>farmer</Text>
            </View>
            <Animated.View style={pulseStyle}>
              <LinearGradient
                colors={[palette.neon, palette.neonDim] as any}
                style={styles.scanBadge}
              >
                <Text style={styles.scanNum}>{scansRemaining}</Text>
                <Text style={styles.scanLbl}>SCANS</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        <Pressable onPress={() => router.push('/buy-scans' as any)} style={styles.planCard}>
          <Text style={styles.planLabel}>CURRENT PLAN</Text>
          <Text style={styles.planValue}>{plan.toUpperCase()}</Text>
          <Text style={styles.planLink}>UPGRADE SCANS</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>DIAGNOSE</Text>
        <View style={styles.grid}>
          {FEATURES.map((f) => (
            <Pressable
              key={f.key}
              onPress={() => router.push(('/(tabs)/' + f.key) as any)}
              style={styles.tile}
            >
              <Text style={styles.tileEmoji}>{f.letter}</Text>
              <Text style={styles.tileTitle}>{f.title}</Text>
              <Text style={styles.tileSub}>{f.sub}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 140 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { ...typography.body, color: palette.textMuted },
  name: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  scanBadge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  scanNum: { fontSize: 26, fontWeight: '900', color: palette.obsidian },
  scanLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: palette.obsidian },
  planCard: {
    marginTop: spacing.xl, padding: spacing.xl,
    borderRadius: radius.lg, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border,
  },
  planLabel: { ...typography.micro, color: palette.textMuted },
  planValue: { fontSize: 24, fontWeight: '900', color: palette.neon, marginTop: 4 },
  planLink: { marginTop: spacing.md, color: palette.neon, fontWeight: '800' },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: {
    width: '48%', padding: spacing.lg, borderRadius: radius.lg,
    backgroundColor: palette.surface, borderWidth: 1, borderColor: palette.border,
    minHeight: 140,
  },
  tileEmoji: { fontSize: 32, fontWeight: '900', color: palette.neon },
  tileTitle: { fontSize: 15, fontWeight: '800', color: palette.text, marginTop: spacing.md },
  tileSub: { ...typography.micro, color: palette.textMuted, marginTop: 2 },
});
