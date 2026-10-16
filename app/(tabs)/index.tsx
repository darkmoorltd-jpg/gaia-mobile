// app/(tabs)/index.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ImageBackground,
  useWindowDimensions,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { walletMe } from '../../src/utils/wallet';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

interface TileItem {
  key: string;
  title: string;
  sub: string;
  img: string;
  route: string;
  flag?: string;
}

const DIAGNOSE: TileItem[] = [
  { key: 'crops',     title: 'Crops',     sub: '60+ diseases',     img: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800', route: '/(tabs)/crops',     flag: 'crops' },
  { key: 'pests',     title: 'Pests',     sub: '102 species',      img: 'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=800', route: '/(tabs)/pests',     flag: 'pests' },
  { key: 'soil',      title: 'Soil',      sub: '11 types',         img: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800', route: '/(tabs)/soil',      flag: 'soil' },
  { key: 'livestock', title: 'Livestock', sub: 'Cattle + Poultry', img: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800', route: '/(tabs)/livestock', flag: 'livestock' },
];

const MY_FARM: TileItem[] = [
  { key: 'seller',   title: 'Seller',           sub: 'Your listings & sales',    img: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=800', route: '/marketplace-store', flag: 'marketplace' },
  { key: 'mapping',  title: 'Farm Mapping',     sub: 'Walk your farm boundary',  img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', route: '/farm-mapping' },
  { key: 'journal',  title: 'Farm Journal',     sub: 'Daily notes & records',    img: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800', route: '/journal' },
  { key: 'calendar', title: 'Farming Calendar', sub: 'Season plan by crop',      img: 'https://images.unsplash.com/photo-1506784390229-73e0b7c9c8e9?w=800', route: '/calendar', flag: 'calendar' },
];

const AI_TOOLS: TileItem[] = [
  { key: 'agro',      title: 'Agro Tools', sub: 'Yield, profit, fertilizer', img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', route: '/agro-tools' },
  { key: 'satellite', title: 'Satellite',  sub: 'Monitor from space',       img: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', route: '/satellite', flag: 'satellite' },
];

const MARKET: TileItem[] = [
  { key: 'marketplace', title: 'Marketplace', sub: 'Buy and sell produce', img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800', route: '/marketplace', flag: 'marketplace' },
  { key: 'buy-scans',   title: 'Buy Scans',   sub: 'Top up your balance',  img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=800', route: '/buy-scans' },
];

export default function Home() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const palette = useTheme((s) => s.palette);
  const styles = useMemo(() => createStyles(palette, width), [palette, width]);

  const user = useAuth((s) => s.user);
  const scansRemaining = useAuth((s) => s.scansRemaining);
  const plan = useAuth((s) => s.plan);
  const refreshScans = useAuth((s) => s.refreshScans);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [badgeTier, setBadgeTier] = useState<string | null>(null);
  const [gaiaAcct, setGaiaAcct] = useState<string | null>(null);
  const [gaiaBal, setGaiaBal] = useState<number>(0);
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const [walletRes, badgeRes, flagsRes] = await Promise.allSettled([
        walletMe(),
        supabase.rpc('badge_current'),
        supabase.from('app_settings').select('value').eq('key', 'feature_flags').maybeSingle(),
      ]);

      if (walletRes.status === 'fulfilled' && walletRes.value) {
        setGaiaAcct(walletRes.value.wallet.account_number);
        setGaiaBal(Number(walletRes.value.wallet.balance || 0));
      }

      if (badgeRes.status === 'fulfilled') {
        const tier = badgeRes.value.data?.tier;
        setBadgeTier(tier || null);
      }

      if (flagsRes.status === 'fulfilled') {
        const v = flagsRes.value.data?.value;
        setFlags(v && typeof v === 'object' ? v : {});
      } else {
        setFlags({});
      }
    } catch (e: any) {
      setLoadError(e?.message || 'Some data failed to load');
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
      refreshScans().catch(() => {});
    }, [load, refreshScans]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([load(), refreshScans()]);
    } finally {
      setRefreshing(false);
    }
  }, [load, refreshScans]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'farmer';

  const passFlag = useCallback(
    (tile: TileItem) => {
      if (!tile.flag) return true;
      if (!flags) return true;
      return flags[tile.flag] !== false;
    },
    [flags],
  );

  const diagnoseTiles = useMemo(() => DIAGNOSE.filter(passFlag), [passFlag]);
  const farmTiles     = useMemo(() => MY_FARM.filter(passFlag), [passFlag]);
  const aiTiles       = useMemo(() => AI_TOOLS.filter(passFlag), [passFlag]);
  const marketTiles   = useMemo(() => MARKET.filter(passFlag), [passFlag]);

  const Tile = useCallback(
    ({ item, delay }: { item: TileItem; delay: number }) => (
      <Animated.View entering={FadeInDown.delay(delay).duration(500)} style={styles.tileOuter}>
        <Pressable
          onPress={() => router.push(item.route as any)}
          style={({ pressed }) => [styles.tilePress, pressed && { opacity: 0.85 }]}
        >
          <ImageBackground source={{ uri: item.img }} style={styles.tile} imageStyle={styles.tileImage}>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={styles.tileOverlay}>
              <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.tileSub} numberOfLines={1}>{item.sub}</Text>
            </LinearGradient>
          </ImageBackground>
        </Pressable>
      </Animated.View>
    ),
    [router, styles],
  );

  const badgeColor = useMemo(() => {
    switch (badgeTier) {
      case 'platinum': return '#e5e4e2';
      case 'gold':     return '#ffd700';
      case 'silver':   return '#b0bec5';
      case 'bronze':   return '#c68a5c';
      default:         return null;
    }
  }, [badgeTier]);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.neon} />
        }
      >
        <Animated.View entering={FadeInDown.duration(500)} style={styles.headerRow}>
          <View style={styles.flex1}>
            <Text style={styles.greeting}>{greeting},</Text>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
              {badgeColor ? (
                <View style={[styles.badgeChip, { backgroundColor: badgeColor }]}>
                  <Text style={styles.badgeChipTxt}>
                    {String(badgeTier).toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
          <LinearGradient colors={[palette.neon, palette.neonDim]} style={styles.scanBadge}>
            <Text style={styles.scanNum}>{scansRemaining}</Text>
            <Text style={styles.scanLbl}>SCANS</Text>
          </LinearGradient>
        </Animated.View>

        {loadError ? (
          <Pressable onPress={load} style={styles.errorBar}>
            <Text style={styles.errorTxt}>{loadError} · tap to retry</Text>
          </Pressable>
        ) : null}

        <Animated.View entering={FadeInDown.delay(80).duration(500)}>
          <LinearGradient colors={[palette.neonSoft, palette.surface]} style={styles.planCard}>
            <View style={styles.flex1}>
              <Text style={styles.planLabel}>PLAN</Text>
              <Text style={styles.planValue}>{String(plan || 'free').toUpperCase()}</Text>
            </View>
            <Pressable
              onPress={() => router.push('/buy-scans' as any)}
              style={({ pressed }) => [styles.planBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.planBtnText}>UPGRADE</Text>
            </Pressable>
          </LinearGradient>
        </Animated.View>

        {gaiaAcct ? (
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <LinearGradient
              colors={['#0d1410', '#0a1a10', '#0d1410']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.walletCard}
            >
              <View style={styles.flex1}>
                <Text style={styles.walletKicker}>MY GAIA ACCOUNT</Text>
                <Text style={styles.walletAcct}>{gaiaAcct}</Text>
                <Text style={styles.walletBal}>
                  Balance ₦{Number(gaiaBal).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/wallet' as any)}
                style={({ pressed }) => [styles.walletBtn, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.walletBtnTxt}>WALLET</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        ) : null}

        <Animated.View entering={FadeInDown.delay(120).duration(550)}>
          <Pressable
            onPress={() => router.push('/season' as any)}
            style={({ pressed }) => [styles.seasonOuter, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          >
            <LinearGradient
              colors={['#ffb300', '#ff8f00', '#e65100']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.seasonBg}
            >
              <View style={styles.seasonLeft}>
                <Text style={styles.seasonEmoji}>🌾</Text>
              </View>
              <View style={styles.seasonRight}>
                <Text style={styles.seasonBadgeText}>SEASON</Text>
                <Text style={styles.seasonTitle}>Follow my crop</Text>
                <Text style={styles.seasonSub}>Plant · Track · Harvest · Profit</Text>
              </View>
              <Text style={styles.seasonArrow}>›</Text>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <View style={styles.communityRow}>
          <Pressable
            onPress={() => router.push('/pulse' as any)}
            style={({ pressed }) => [styles.communityBtn, styles.communityPulse, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.communityEmoji}>📡</Text>
            <Text style={[styles.communityTitle, { color: '#b388ff' }]}>Pulse</Text>
            <Text style={styles.communitySub}>What's happening</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/coop' as any)}
            style={({ pressed }) => [styles.communityBtn, styles.communityCoop, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.communityEmoji}>🤝</Text>
            <Text style={[styles.communityTitle, { color: '#00c853' }]}>Coop Pool</Text>
            <Text style={styles.communitySub}>Sell as one</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/sos' as any)}
            style={({ pressed }) => [styles.communityBtn, styles.communitySos, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.communityEmoji}>🆘</Text>
            <Text style={[styles.communityTitle, { color: '#ff3b5c' }]}>SOS</Text>
            <Text style={styles.communitySub}>Emergency</Text>
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(140).duration(550)}>
          <Pressable
            onPress={() => router.push('/voice' as any)}
            style={({ pressed }) => [styles.heroOuter, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}
          >
            <LinearGradient
              colors={['#00cc6a', '#009e52', '#00582e']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroBg}
            >
              <View style={styles.heroLeft}>
                <Text style={styles.heroEmoji}>🧑‍🌾</Text>
              </View>
              <View style={styles.heroRight}>
                <View style={styles.heroBadgeRow}>
                  <View style={styles.heroDot} />
                  <Text style={styles.heroBadgeText}>LIVE</Text>
                </View>
                <Text style={styles.heroTitle}>GAIA Agronomist</Text>
                <Text style={styles.heroSub}>Voice + chat · ask me anything</Text>
              </View>
              <View style={styles.heroArrowWrap}>
                <Text style={styles.heroArrow}>›</Text>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        {diagnoseTiles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>DIAGNOSE</Text>
            <View style={styles.grid}>
              {diagnoseTiles.map((item, i) => (
                <Tile key={item.key} item={item} delay={220 + i * 60} />
              ))}
            </View>
          </>
        ) : null}

        {farmTiles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>MY FARM</Text>
            <View style={styles.grid}>
              {farmTiles.map((item, i) => (
                <Tile key={item.key} item={item} delay={480 + i * 60} />
              ))}
            </View>
          </>
        ) : null}

        {aiTiles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>AI TOOLS</Text>
            <View style={styles.grid}>
              {aiTiles.map((item, i) => (
                <Tile key={item.key} item={item} delay={720 + i * 60} />
              ))}
            </View>
          </>
        ) : null}

        {marketTiles.length > 0 ? (
          <>
            <Text style={styles.sectionLabel}>MARKET</Text>
            <View style={styles.grid}>
              {marketTiles.map((item, i) => (
                <Tile key={item.key} item={item} delay={860 + i * 60} />
              ))}
            </View>
          </>
        ) : null}

        {isAdmin ? (
          <Animated.View entering={FadeInDown.delay(1100).duration(400)}>
            <Pressable
              onPress={() => router.push('/admin' as any)}
              style={({ pressed }) => [styles.adminCard, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
              <Text style={styles.adminArrow}>›</Text>
            </Pressable>
          </Animated.View>
        ) : null}

        <View style={styles.spacer} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any, screenWidth: number) => {
  const TILE_W = (screenWidth - 52) / 2;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: p.obsidian },
    scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
    flex1: { flex: 1 },

    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    greeting: { fontSize: 15, fontWeight: '500', color: p.textMuted },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    name: {
      fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1.2,
      textTransform: 'capitalize', flexShrink: 1,
    },
    badgeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeChipTxt: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
    scanBadge: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    scanNum: { fontSize: 28, fontWeight: '900', color: p.obsidian },
    scanLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.obsidian },

    errorBar: {
      marginTop: 12, padding: 10, borderRadius: 10,
      backgroundColor: 'rgba(255,59,92,0.1)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)',
    },
    errorTxt: { fontSize: 11, color: p.danger, fontWeight: '700', textAlign: 'center' },

    planCard: {
      marginTop: 24, padding: 24, borderRadius: 22, flexDirection: 'row',
      alignItems: 'center', borderWidth: 1, borderColor: p.border,
    },
    planLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: p.textMuted },
    planValue: { fontSize: 22, fontWeight: '900', color: p.neon, marginTop: 2 },
    planBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.neon },
    planBtnText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },

    walletCard: {
      marginTop: 16, padding: 16, borderRadius: 20,
      borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)',
      flexDirection: 'row', alignItems: 'center',
    },
    walletKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(0,255,136,0.8)' },
    walletAcct: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 6 },
    walletBal: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    walletBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#00ff88' },
    walletBtnTxt: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1.2 },

    seasonOuter: {
      marginTop: 20, borderRadius: 24, overflow: 'hidden',
      shadowColor: '#ffb300', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
    },
    seasonBg: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24 },
    seasonLeft: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center', justifyContent: 'center', marginRight: 16,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    },
    seasonEmoji: { fontSize: 34 },
    seasonRight: { flex: 1 },
    seasonBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)', marginBottom: 4 },
    seasonTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
    seasonSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
    seasonArrow: { fontSize: 26, color: '#ffffff', fontWeight: '300', marginLeft: 8 },

    communityRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
    communityBtn: { flex: 1, padding: 14, borderRadius: 16, borderWidth: 1 },
    communityPulse: { backgroundColor: 'rgba(179,136,255,0.06)', borderColor: 'rgba(179,136,255,0.3)' },
    communityCoop: { backgroundColor: 'rgba(0,200,83,0.06)', borderColor: 'rgba(0,200,83,0.3)' },
    communitySos: { backgroundColor: 'rgba(255,59,92,0.06)', borderColor: 'rgba(255,59,92,0.3)' },
    communityEmoji: { fontSize: 20 },
    communityTitle: { fontSize: 11, fontWeight: '900', marginTop: 6, letterSpacing: 0.4 },
    communitySub: { fontSize: 9, color: 'rgba(255,255,255,0.5)', marginTop: 2 },

    heroOuter: {
      marginTop: 20, borderRadius: 24, overflow: 'hidden',
      shadowColor: '#00cc6a', shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35, shadowRadius: 20, elevation: 10,
    },
    heroBg: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24 },
    heroLeft: {
      width: 64, height: 64, borderRadius: 32,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center', justifyContent: 'center', marginRight: 16,
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)',
    },
    heroEmoji: { fontSize: 34 },
    heroRight: { flex: 1 },
    heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' },
    heroBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#ffffff' },
    heroTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
    heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
    heroArrowWrap: {
      width: 32, height: 32, borderRadius: 16,
      backgroundColor: 'rgba(255,255,255,0.22)',
      alignItems: 'center', justifyContent: 'center',
    },
    heroArrow: { fontSize: 22, color: '#ffffff', fontWeight: '300', lineHeight: 24 },

    sectionLabel: {
      fontSize: 11, fontWeight: '600', letterSpacing: 1.5,
      color: p.textMuted, marginTop: 32, marginBottom: 12,
    },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tileOuter: { width: TILE_W },
    tilePress: { borderRadius: 22, overflow: 'hidden' },
    tile: { borderRadius: 22, overflow: 'hidden', height: 150, justifyContent: 'flex-end' },
    tileImage: { borderRadius: 22 },
    tileOverlay: { padding: 14 },
    tileTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
    tileSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },

    adminCard: {
      marginTop: 24, padding: 16, borderRadius: 16,
      borderWidth: 1.5, borderColor: p.danger,
      backgroundColor: 'rgba(255,60,90,0.08)',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
    adminArrow: { fontSize: 22, color: p.danger },

    spacer: { height: 140 },
  });
};
