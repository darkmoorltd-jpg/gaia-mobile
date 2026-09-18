import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ImageBackground, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const TILES = [
  { key: 'crops',     title: 'Crops',     sub: '60+ diseases',  img: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800' },
  { key: 'pests',     title: 'Pests',     sub: '102 species',   img: 'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=800' },
  { key: 'soil',      title: 'Soil',      sub: '11 types',      img: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800' },
  { key: 'livestock', title: 'Livestock', sub: 'Cattle+Poultry', img: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800' },
];

export default function Home() {
  const router = useRouter();
  const { palette } = useTheme();
  const { scansRemaining, plan, refreshScans, user } = useAuth();
  const styles = createStyles(palette);
  const isAdmin = user?.email?.toLowerCase() === 'darkmoorltd@gmail.com';

  const pulse = useSharedValue(1);
  useEffect(() => {
    refreshScans();
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1400 }),
        withTiming(1, { duration: 1400 })
      ),
      -1,
      true,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'farmer';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>{greeting},</Text>
              <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
            </View>
            <Animated.View style={pulseStyle}>
              <LinearGradient colors={[palette.neon, palette.neonDim] as any} style={styles.scanBadge}>
                <Text style={styles.scanNum}>{scansRemaining}</Text>
                <Text style={styles.scanLbl}>SCANS</Text>
              </LinearGradient>
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(80)}>
          <LinearGradient colors={[palette.neonSoft, palette.surface] as any} style={styles.planCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>PLAN</Text>
              <Text style={styles.planValue}>{plan.toUpperCase()}</Text>
            </View>
            <Pressable onPress={() => router.push('/buy-scans' as any)} style={styles.planBtn}>
              <Text style={styles.planBtnText}>UPGRADE</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        <Text style={styles.sectionLabel}>DIAGNOSE</Text>
        <View style={styles.grid}>
          {TILES.map((t, i) => (
            <Animated.View
              key={t.key}
              entering={FadeInDown.delay(120 + i * 60)}
              style={styles.tileOuter}
            >
              <Pressable onPress={() => router.push(('/(tabs)/' + t.key) as any)} style={styles.tile}>
                <ImageBackground
                  source={{ uri: t.img }}
                  style={styles.tileImg}
                  imageStyle={{ borderRadius: 22 }}
                >
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.85)'] as any}
                    style={styles.tileOverlay}
                  >
                    <Text style={styles.tileTitle}>{t.title}</Text>
                    <Text style={styles.tileSub}>{t.sub}</Text>
                  </LinearGradient>
                </ImageBackground>
              </Pressable>
            </Animated.View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
        <View style={styles.quickRow}>
          <Pressable onPress={() => router.push('/voice' as any)} style={styles.quick}>
            <Text style={styles.quickIcon}>V</Text>
            <Text style={styles.quickLabel}>Voice AI</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/marketplace' as any)} style={styles.quick}>
            <Text style={styles.quickIcon}>M</Text>
            <Text style={styles.quickLabel}>Market</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/calendar' as any)} style={styles.quick}>
            <Text style={styles.quickIcon}>C</Text>
            <Text style={styles.quickLabel}>Calendar</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/history' as any)} style={styles.quick}>
            <Text style={styles.quickIcon}>H</Text>
            <Text style={styles.quickLabel}>History</Text>
          </Pressable>
        </View>

        {isAdmin ? (
          <Pressable onPress={() => router.push('/admin' as any)} style={styles.adminCard}>
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminArrow}>›</Text>
          </Pressable>
        ) : null}

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { fontSize: 15, color: p.textMuted, fontWeight: '500' },
  name: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, textTransform: 'capitalize' },
  scanBadge: {
    width: 74, height: 74, borderRadius: 37,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: p.neon, shadowOpacity: 0.55, shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 }, elevation: 12,
  },
  scanNum: { fontSize: 26, fontWeight: '900', color: p.obsidian },
  scanLbl: { fontSize: 9, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  planCard: {
    flexDirection: 'row', alignItems: 'center',
    padding: 20, borderRadius: radius.xl, marginTop: spacing.xl,
    borderWidth: 1, borderColor: p.border,
  },
  planLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted },
  planValue: { fontSize: 22, fontWeight: '900', color: p.neon, letterSpacing: -0.5, marginTop: 4 },
  planBtn: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: radius.full, backgroundColor: p.neon,
  },
  planBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: p.obsidian },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1.5,
    color: p.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileOuter: { width: '48%', borderRadius: 22, overflow: 'hidden' },
  tile: { borderRadius: 22, overflow: 'hidden' },
  tileImg: { aspectRatio: 1 },
  tileOverlay: {
    flex: 1, padding: 16, justifyContent: 'flex-end',
  },
  tileTitle: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  tileSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.7)', marginTop: 2, letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', gap: 10 },
  quick: {
    flex: 1, aspectRatio: 0.9,
    borderRadius: radius.lg, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  quickIcon: { fontSize: 22, fontWeight: '900', color: p.neon },
  quickLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, color: p.text },
  adminCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing.xl, padding: 18,
    borderRadius: radius.lg, backgroundColor: 'rgba(255,60,90,0.08)',
    borderWidth: 1.5, borderColor: p.danger,
  },
  adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  adminArrow: { fontSize: 22, color: p.danger },
});
