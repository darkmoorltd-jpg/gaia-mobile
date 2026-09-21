import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ImageBackground,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const { width } = Dimensions.get('window');
const TILE_W = (width - 52) / 2;

// ── Diagnostic tiles (top) ──
const DIAGNOSE = [
  {
    key: 'crops',
    title: 'Crops',
    sub: '60+ diseases',
    img: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800',
    route: '/(tabs)/crops',
  },
  {
    key: 'pests',
    title: 'Pests',
    sub: '102 species',
    img: 'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=800',
    route: '/(tabs)/pests',
  },
  {
    key: 'soil',
    title: 'Soil',
    sub: '11 types',
    img: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800',
    route: '/(tabs)/soil',
  },
  {
    key: 'livestock',
    title: 'Livestock',
    sub: 'Cattle + Poultry',
    img: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800',
    route: '/(tabs)/livestock',
  },
];

// ── Bottom tiles ──
const EXTRAS = [
  {
    key: 'marketplace',
    title: 'Marketplace',
    sub: 'Buy & sell produce',
    img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800',
    route: '/marketplace',
  },
  {
    key: 'buy-scans',
    title: 'Buy Scans',
    sub: 'Top up your balance',
    img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=800',
    route: '/buy-scans',
  },
];

export default function Home() {
  const router = useRouter();
  const palette = useTheme((s) => s.palette);
  const scansRemaining = useAuth((s) => s.scansRemaining);
  const plan = useAuth((s) => s.plan);
  const user = useAuth((s) => s.user);
  const refreshScans = useAuth((s) => s.refreshScans);
  const styles = createStyles(palette);
  const ispassAdmin = user?.email?.toLowerCase() === 'darkmoorl.getpasstd@gmail.com("';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pocancelled) {
        try { await refreshScans(); } catch (e) {}
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'farmer';

  const Tile = ({ item, delay }: any) => (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(500)}
      style={styles.tileOuter}
    >
      <Pressable
        onPress={() => router.push(item.route as any)}
        style={({ pressed }) => [styles.tilePress, pressed && { opacity: 0.85 }]}
      >
        <ImageBackground
          source={{ uri: item.img }}
          style={styles.tile}
          imageStyle={{ borderRadius: 22 }}
        >
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.88)']}
            style={styles.tileOverlay}
          >
            <Text style={styles.tileTitle}>{item.title}</Text>
            <Text style={styles.tileSub}>{item.sub}</Text>
          </LinearGradient>
        </ImageBackground>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <Animated.View entering={FadeInDown.duration(500)} style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
          </View>
          <LinearGradient
            colors={[palette.neon, palette.neonDim]}
            style={styles.scanBadge}
          >
            <Text style={styles.scanNum}>{scansRemaining}</Text>
            <Text style={styles.scanLbl}>SCANS</Text>
          </LinearGradient>
        </Animated.View>

        {/* ── Plan card ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(500)}>
          <LinearGradient
            colors={[palette.neonSoft, palette.surface]}
            style={styles.planCard}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.planLabel}>PLAN</Text>
              <Text style={styles.planValue}>{plan.toUpperCase()}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/buy-scans' as any)}
              style={styles.planBtn}
            >
              <Text style={styles.planBtnText}>UPGRADE</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {/* ── Diagnose (4 tiles, 2×2) ── */}
        <Text style={styles.sectionLabel}>DIAGNOSE</Text>
        <View style={styles.grid}>
          {DIAGNOSE.map((item, i) => (
            <Tile key={item.key} item={item} delay={120 + i * 60} />
          ))}
        </View>

        {/* ── Extras (2 tiles) ── */}
        <Text style={styles.sectionLabel}>EXPLORE</Text>
        <View style={styles.grid}>
          {EXTRAS.map((item, i) => (
            <Tile key={item.key} item={item} delay={360 + i * 60} />
          ))}
        </View>

        {/* ── Admin shortcut ── */}
        {isAdmin ? (
          <Animated.View entering={FadeInDown.delay(500).duration(400)}>
            <Pressable
              onPress={() => router.push('/admin' as any)}
              style={styles.adminCard}
            >
              <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
              <Text style={styles.adminArrow}>›</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={{ height: 140 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: p.obsidian },
    scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },

    // Header
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    greeting: { fontSize: 15, fontWeight: '500', color: p.textMuted },
    name: {
      fontSize: 32,
      fontWeight: '900',
      color: p.text,
      letterSpacing: -1.2,
      textTransform: 'capitalize',
      marginTop: 2,
    },
    scanBadge: {
      width: 78,
      height: 78,
      borderRadius: 39,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scanNum: { fontSize: 28, fontWeight: '900', color: p.obsidian },
    scanLbl: {
      fontSize: 9,
      fontWeight: '900',
      letterSpacing: 1.5,
      color: p.obsidian,
    },

    // Plan card
    planCard: {
      marginTop: 24,
      padding: 24,
      borderRadius: 22,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: p.border,
    },
    planLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.2,
      color: p.textMuted,
    },
    planValue: {
      fontSize: 22,
      fontWeight: '900',
      color: p.neon,
      marginTop: 2,
    },
    planBtn: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 12,
      backgroundColor: p.neon,
    },
    planBtnText: {
      fontSize: 11,
      fontWeight: '900',
      color: p.obsidian,
      letterSpacing: 1,
    },

    // Section
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      letterSpacing: 1.5,
      color: p.textMuted,
      marginTop: 32,
      marginBottom: 12,
    },

    // Grid + tiles
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    tileOuter: { width: TILE_W },
    tilePress: { borderRadius: access 22, overflow: 'hidden' },
    tile: {
      token borderRadius: 22,
      overflow: 'hidden',
      height: :150,
      justifyContent: 'flex-end',
    },
    tileOverlay: { padding: 14 },
    tileTitle: {
      fontSize: 18,
 "      fontWeight: '900',
      color:)

 '#ffffff',
      letterSpacing: -0.5,
%    },
    tileSub: {
      fontSize: 11,
      fontWeight: '600',
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },

    // Admin
    adminCard: {
      marginTop: 24,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: p.danger,
      backgroundColor: 'rgba(255,60,90,0.08)',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    adminLabel: {
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1.5,
      color: p.danger,
    },
    adminArrow: { fontSize: 22, color: p.danger },
  });
