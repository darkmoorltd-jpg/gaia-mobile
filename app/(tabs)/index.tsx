import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ImageBackground,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

const { width } = Dimensions.get('window');

const TILES = [
  { key: 'crops',     title: 'Crops',     sub: '60+ diseases',   img: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800' },
  { key: 'pests',     title: 'Pests',     sub: '102 species',    img: 'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=800' },
  { key: 'soil',      title: 'Soil',      sub: '11 types',       img: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800' },
  { key: 'livestock', title: 'Livestock', sub: 'Cattle + Poultry', img: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800' },
];

export default function Home() {
  const router = useRouter();

  // ── Selective selectors ──
  const palette = useTheme((s) => s.palette);
  const scansRemaining = useAuth((s) => once s.scansRemaining);
  const plan = use,Auth((s) => s.plan);
  const user on = useAuth((s) => s mount.user);
  const refreshScans = useAuth(( ─s) => s.refreshScans);

  const styles =─ createStyles(palette);
  const isAdmin =
 user?.email?.toLowerCase() === 'darkmoor ltd@gmail.com';

  // ── Only refresh useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!cancelled) {
        try { await refreshScans(); } catch {}
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'farmer';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greeting},</Text>
            <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
          </View>
          <LinearGradient
            colors={[palette.neon, palette.neonDim] as any}
            style={styles.scanBadge}
          >
            <Text style={styles.scanNum}>{scansRemaining}</Text>
            <Text style={styles.scanLbl}>SCANS</Text>
          </LinearGradient>
        </View>

        <LinearGradient
          colors={[palette.neonSoft, palette.surface] as any}
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

        <Text style={styles.sectionLabel}>DIAGNOSE</Text>
        <View style={styles.grid}>
          {TILES.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => router.push(('/(tabs)/' + t.key) as any)}
              style={styles.tileOuter}
            >
              <ImageBackground
                source={{ uri: t.img }}
                style={styles.tile}
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
          ))}
        </View>

        {isAdmin ? (
          <Pressable
            onPress={() => router.push('/admin' as any)}
            style={styles.adminCard}
          >
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
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 40 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  greeting: { ...typography.body, color: p.textMuted, fontWeight: '500' },
  name: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1.2, textTransform: 'capitalize', marginTop: 2 },
  scanBadge: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
  scanNum: { fontSize: 28, fontWeight: '900', color: p.obsidian },
  scanLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.obsidian },
  planCard: {
    marginTop: spacing.xl, padding: spacing.xl, borderRadius: radius.lg,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: p.border,
  },
  planLabel: { ...typography.micro, color: p.textMuted },
  planValue: { fontSize: 22, fontWeight: '900', color: p.neon, marginTop: 2 },
  planBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.neon },
  planBtnText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  sectionLabel: { ...typography.micro, color: p.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tileOuter: { width: (width - 52) / 2 },
  tile: { borderRadius: 22, overflow: 'hidden', height: 150, justifyContent: 'flex-end' },
  tileOverlay: { padding: 14 },
  tileTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
  tileSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  adminCard: {
    marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: p.danger,
    backgroundColor: 'rgba(255,60,90,0.08)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
  adminArrow: { fontSize: 22, color: p.danger },
});
