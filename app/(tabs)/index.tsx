// app/(tabs)/index.tsx
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  ImageBackground, useWindowDimensions, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import { walletMe } from '../../src/utils/wallet';
import WeatherWidget from '../../src/components/WeatherWidget';
import StreakWidget from '../../src/components/StreakWidget';
import PlantIDCard from '../../src/components/PlantIDCard';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

interface TileItem {
  key: string;
  title: string;
  sub: string;
  img: string;
  route: string;
  flag?: string;
}

const SECTIONS = [
  { id: 'diagnose', label: 'DIAGNOSE', tiles: [
    { key: 'crops',     title: 'Crops',     sub: '60+ diseases',     img: 'https://images.unsplash.com/photo-1523348837708-15d4a09cfac2?w=800', route: '/(tabs)/crops',     flag: 'crops' },
    { key: 'pests',     title: 'Pests',     sub: '102 species',      img: 'https://images.unsplash.com/photo-1590691566903-692bf5ca7493?w=800', route: '/(tabs)/pests',     flag: 'pests' },
    { key: 'soil',      title: 'Soil',      sub: '11 types',         img: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800', route: '/(tabs)/soil',      flag: 'soil' },
    { key: 'livestock', title: 'Livestock', sub: 'Cattle + Poultry', img: 'https://images.unsplash.com/photo-1570042225831-d98fa7577f1e?w=800', route: '/(tabs)/livestock', flag: 'livestock' },
  ]},
  { id: 'my_farm', label: 'MY FARM', tiles: [
    { key: 'seller',   title: 'Seller',           sub: 'Your listings & sales',   img: 'https://images.unsplash.com/photo-1595246140625-573b715d11dc?w=800', route: '/marketplace-store', flag: 'marketplace' },
    { key: 'mapping',  title: 'Farm Mapping',     sub: 'Walk your farm boundary', img: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=800', route: '/farm-mapping' },
    { key: 'journal',  title: 'Farm Journal',     sub: 'Daily notes & records',   img: 'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=800', route: '/journal' },
    { key: 'calendar', title: 'Farming Calendar', sub: 'Season plan by crop',     img: 'https://images.unsplash.com/photo-1506784390229-73e0b7c9c8e9?w=800', route: '/calendar', flag: 'calendar' },
  ]},
  { id: 'ai_tools', label: 'AI TOOLS', tiles: [
    { key: 'agro',      title: 'Agro Tools', sub: 'Yield, profit, fertilizer', img: 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', route: '/agro-tools' },
    { key: 'satellite', title: 'Satellite',  sub: 'Monitor from space',       img: 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=800', route: '/satellite', flag: 'satellite' },
  ]},
  { id: 'market', label: 'MARKET', tiles: [
    { key: 'marketplace', title: 'Marketplace', sub: 'Buy and sell produce', img: 'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800', route: '/marketplace', flag: 'marketplace' },
    { key: 'buy-scans',   title: 'Buy Scans',   sub: 'Top up your balance',  img: 'https://images.unsplash.com/photo-1580519542036-c47de6196ba5?w=800', route: '/buy-scans' },
  ]},
];

// Top-level blocks the user can hide/reorder
const BLOCKS = [
  { id: 'header',       label: 'Header (greeting + scans)' },
  { id: 'weather',      label: 'Weather (live)' },
  { id: 'streak',       label: 'Streak counter' },
  { id: 'plan',         label: 'Plan card' },
  { id: 'wallet',       label: 'Wallet card' },
  { id: 'season',       label: 'Season hero' },
  { id: 'community',    label: 'Community row (Pulse/Coop/SOS)' },
  { id: 'agronomist',   label: 'GAIA Agronomist' },
  { id: 'section:diagnose', label: 'DIAGNOSE section' },
  { id: 'section:my_farm',  label: 'MY FARM section' },
  { id: 'section:ai_tools', label: 'AI TOOLS section' },
  { id: 'section:market',   label: 'MARKET section' },
  { id: 'admin',        label: 'Admin console' },
];

const DEFAULT_BLOCK_ORDER = BLOCKS.map((b) => b.id);

type Prefs = { hidden: string[]; ordering: Record<string, string[]> };
const EMPTY_PREFS: Prefs = { hidden: [], ordering: {} };

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
  const [prefs, setPrefs] = useState<Prefs>(EMPTY_PREFS);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // -------- load --------
  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [walletRes, badgeRes, flagsRes, prefsRes] = await Promise.allSettled([
        walletMe(),
        supabase.rpc('badge_current'),
        supabase.from('app_settings').select('value').eq('key', 'feature_flags').maybeSingle(),
        supabase.from('user_dashboard_prefs').select('hidden,ordering').eq('user_id', user.id).maybeSingle(),
      ]);
      if (walletRes.status === 'fulfilled' && walletRes.value) {
        setGaiaAcct(walletRes.value.wallet.account_number);
        setGaiaBal(Number(walletRes.value.wallet.balance || 0));
      }
      if (badgeRes.status === 'fulfilled') setBadgeTier(badgeRes.value.data?.tier || null);
      if (flagsRes.status === 'fulfilled') {
        const v = flagsRes.value.data?.value;
        setFlags(v && typeof v === 'object' ? v : {});
      } else setFlags({});
      if (prefsRes.status === 'fulfilled' && prefsRes.value.data) {
        setPrefs({
          hidden: Array.isArray(prefsRes.value.data.hidden) ? prefsRes.value.data.hidden : [],
          ordering: prefsRes.value.data.ordering && typeof prefsRes.value.data.ordering === 'object'
            ? prefsRes.value.data.ordering
            : {},
        });
      }
    } catch {}
  }, [user]);

  useFocusEffect(useCallback(() => { load(); refreshScans().catch(() => {}); }, [load, refreshScans]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await Promise.allSettled([load(), refreshScans()]); }
    finally { setRefreshing(false); }
  }, [load, refreshScans]);

  // -------- save --------
  const savePrefs = useCallback(async (next: Prefs) => {
    if (!user) return;
    setSaving(true);
    try {
      await supabase.from('user_dashboard_prefs').upsert({
        user_id: user.id,
        hidden: next.hidden,
        ordering: next.ordering,
        updated_at: new Date().toISOString(),
      });
    } catch {}
    setSaving(false);
  }, [user]);

  const toggleHidden = useCallback((key: string) => {
    setPrefs((p) => {
      const next = {
        ...p,
        hidden: p.hidden.includes(key) ? p.hidden.filter((k) => k !== key) : [...p.hidden, key],
      };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

  const moveItem = useCallback((listKey: string, key: string, dir: -1 | 1, defaultOrder: string[]) => {
    setPrefs((p) => {
      const current = p.ordering[listKey] && p.ordering[listKey].length
        ? [...p.ordering[listKey]]
        : [...defaultOrder];
      const idx = current.indexOf(key);
      if (idx === -1) return p;
      const swap = idx + dir;
      if (swap < 0 || swap >= current.length) return p;
      [current[idx], current[swap]] = [current[swap], current[idx]];
      const next = { ...p, ordering: { ...p.ordering, [listKey]: current } };
      savePrefs(next);
      return next;
    });
  }, [savePrefs]);

  const resetPrefs = useCallback(() => {
    setPrefs(EMPTY_PREFS);
    savePrefs(EMPTY_PREFS);
  }, [savePrefs]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.email?.split('@')[0] || 'farmer';

  const passFlag = useCallback((tile: TileItem) => {
    if (!tile.flag) return true;
    if (!flags) return true;
    return flags[tile.flag] !== false;
  }, [flags]);

  const orderedBlocks = useMemo(() => {
    const order = prefs.ordering['__blocks__'] && prefs.ordering['__blocks__'].length
      ? prefs.ordering['__blocks__']
      : DEFAULT_BLOCK_ORDER;
    const map = new Map(BLOCKS.map((b) => [b.id, b]));
    const out = order.map((id) => map.get(id)).filter(Boolean) as typeof BLOCKS;
    BLOCKS.forEach((b) => { if (!order.includes(b.id)) out.push(b); });
    return out;
  }, [prefs.ordering]);

  const getSectionTiles = useCallback((section: typeof SECTIONS[0]) => {
    const order = prefs.ordering[section.id] && prefs.ordering[section.id].length
      ? prefs.ordering[section.id]
      : section.tiles.map((t) => t.key);
    const map = new Map(section.tiles.map((t) => [t.key, t]));
    const ordered = order.map((k) => map.get(k)).filter(Boolean) as TileItem[];
    section.tiles.forEach((t) => { if (!order.includes(t.key)) ordered.push(t); });
    return ordered.filter((t) => editMode || passFlag(t));
  }, [prefs, editMode, passFlag]);

  const badgeColor = useMemo(() => {
    switch (badgeTier) {
      case 'platinum': return '#e5e4e2';
      case 'gold':     return '#ffd700';
      case 'silver':   return '#b0bec5';
      case 'bronze':   return '#c68a5c';
      default:         return null;
    }
  }, [badgeTier]);

  // -------- Block wrapper (edit controls) --------
  const Block = ({ id, index, total, children }: { id: string; index: number; total: number; children: React.ReactNode }) => {
    const hidden = prefs.hidden.includes(id);
    const blockDef = BLOCKS.find((b) => b.id === id);
    if (!editMode && hidden) return null;
    return (
      <View style={[styles.blockWrap, hidden && editMode && { opacity: 0.35 }]}>
        {editMode ? (
          <View style={styles.blockBar}>
            <Text style={styles.blockBarLabel} numberOfLines={1}>{blockDef?.label || id}</Text>
            <View style={styles.blockBarBtns}>
              <Pressable
                onPress={() => moveItem('__blocks__', id, -1, DEFAULT_BLOCK_ORDER)}
                disabled={index === 0}
                style={[styles.blockBtn, index === 0 && { opacity: 0.3 }]}
              >
                <Text style={styles.blockBtnTxt}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => moveItem('__blocks__', id, 1, DEFAULT_BLOCK_ORDER)}
                disabled={index === total - 1}
                style={[styles.blockBtn, index === total - 1 && { opacity: 0.3 }]}
              >
                <Text style={styles.blockBtnTxt}>↓</Text>
              </Pressable>
              <Pressable
                onPress={() => toggleHidden(id)}
                style={[styles.blockBtn, { backgroundColor: hidden ? '#00c853' : '#ff3b5c' }]}
              >
                <Text style={styles.blockBtnTxt}>{hidden ? '+' : '×'}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {children}
      </View>
    );
  };

  // -------- Tile --------
  const Tile = ({ item, sectionId, index, total }: any) => {
    const hidden = prefs.hidden.includes(item.key);
    return (
      <View style={[styles.tileOuter, hidden && editMode && { opacity: 0.35 }]}>
        <Pressable
          onPress={() => { if (!editMode) router.push(item.route as any); }}
          style={({ pressed }) => [styles.tilePress, pressed && !editMode && { opacity: 0.85 }]}
        >
          <ImageBackground source={{ uri: item.img }} style={styles.tile} imageStyle={styles.tileImage}>
            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.88)']} style={styles.tileOverlay}>
              <Text style={styles.tileTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.tileSub} numberOfLines={1}>{item.sub}</Text>
            </LinearGradient>
          </ImageBackground>
        </Pressable>
        {editMode ? (
          <View style={styles.tileControls}>
            <Pressable
              onPress={() => toggleHidden(item.key)}
              style={[styles.tileBtn, { backgroundColor: hidden ? '#00c853' : '#ff3b5c' }]}
            >
              <Text style={styles.tileBtnTxt}>{hidden ? '+' : '×'}</Text>
            </Pressable>
            <View style={styles.moveGroup}>
              <Pressable
                onPress={() => moveItem(sectionId, item.key, -1, [])}
                disabled={index === 0}
                style={[styles.tileBtnSmall, index === 0 && { opacity: 0.3 }]}
              >
                <Text style={styles.tileBtnTxt}>↑</Text>
              </Pressable>
              <Pressable
                onPress={() => moveItem(sectionId, item.key, 1, [])}
                disabled={index === total - 1}
                style={[styles.tileBtnSmall, { marginLeft: 6 }, index === total - 1 && { opacity: 0.3 }]}
              >
                <Text style={styles.tileBtnTxt}>↓</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  // -------- Section renderer --------
  const renderSection = (section: typeof SECTIONS[0]) => {
    const tiles = getSectionTiles(section);
    const visible = tiles.filter((t) => editMode || !prefs.hidden.includes(t.key));
    if (visible.length === 0 && !editMode) return null;
    return (
      <>
        <Text style={styles.sectionLabel}>{section.label}</Text>
        <View style={styles.grid}>
          {visible.map((item, i) => (
            <Tile key={item.key} item={item} sectionId={section.id} index={i} total={visible.length} />
          ))}
        </View>
      </>
    );
  };

  // -------- BLOCK RENDERERS --------
  const renderBlock = (id: string) => {
    switch (id) {
      case 'header':
        return (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.headerRow}>
            <View style={styles.flex1}>
              <Text style={styles.greeting}>{greeting},</Text>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{firstName}</Text>
                {badgeColor ? (
                  <View style={[styles.badgeChip, { backgroundColor: badgeColor }]}>
                    <Text style={styles.badgeChipTxt}>{String(badgeTier).toUpperCase()}</Text>
                  </View>
                ) : null}
              </View>
            </View>
            <LinearGradient colors={[palette.neon, palette.neonDim]} style={styles.scanBadge}>
              <Text style={styles.scanNum}>{scansRemaining}</Text>
              <Text style={styles.scanLbl}>SCANS</Text>
            </LinearGradient>
          </Animated.View>
        );

      case 'weather':
        return (
          <Animated.View entering={FadeInDown.delay(40).duration(500)}>
            <WeatherWidget />
        <PlantIDCard />
          </Animated.View>
        );

      case 'streak':
        return (
          <Animated.View entering={FadeInDown.delay(60).duration(500)}>
            <StreakWidget />
          </Animated.View>
        );

      case 'plan':
        return (
          <Animated.View entering={FadeInDown.delay(80).duration(500)}>
            <LinearGradient colors={[palette.neonSoft, palette.surface]} style={styles.planCard}>
              <View style={styles.flex1}>
                <Text style={styles.planLabel}>PLAN</Text>
                <Text style={styles.planValue}>{String(plan || 'free').toUpperCase()}</Text>
              </View>
              <Pressable onPress={() => router.push('/buy-scans' as any)} style={styles.planBtn}>
                <Text style={styles.planBtnText}>UPGRADE</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        );

      case 'wallet':
        if (!gaiaAcct) return null;
        return (
          <Animated.View entering={FadeInDown.delay(100).duration(500)}>
            <LinearGradient colors={['#0d1410', '#0a1a10', '#0d1410']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.walletCard}>
              <View style={styles.flex1}>
                <Text style={styles.walletKicker}>MY GAIA ACCOUNT</Text>
                <Text style={styles.walletAcct}>{gaiaAcct}</Text>
                <Text style={styles.walletBal}>Balance ₦{Number(gaiaBal).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
              </View>
              <Pressable onPress={() => router.push('/wallet' as any)} style={styles.walletBtn}>
                <Text style={styles.walletBtnTxt}>WALLET</Text>
              </Pressable>
            </LinearGradient>
          </Animated.View>
        );

      case 'season':
        return (
          <Animated.View entering={FadeInDown.delay(120).duration(550)}>
            <Pressable onPress={() => router.push('/season' as any)} style={({ pressed }) => [styles.seasonOuter, pressed && { opacity: 0.9 }]}>
              <LinearGradient colors={['#ffb300', '#ff8f00', '#e65100']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.seasonBg}>
                <View style={styles.seasonLeft}><Text style={styles.seasonEmoji}>🌾</Text></View>
                <View style={styles.seasonRight}>
                  <Text style={styles.seasonBadgeText}>SEASON</Text>
                  <Text style={styles.seasonTitle}>Follow my crop</Text>
                  <Text style={styles.seasonSub}>Plant · Track · Harvest · Profit</Text>
                </View>
                <Text style={styles.seasonArrow}>›</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        );

      case 'community':
        return (
          <View style={styles.communityRow}>
            <Pressable onPress={() => router.push('/pulse' as any)} style={[styles.communityBtn, styles.communityPulse]}>
              <Text style={styles.communityEmoji}>📡</Text>
              <Text style={[styles.communityTitle, { color: '#b388ff' }]}>Pulse</Text>
              <Text style={styles.communitySub}>What's happening</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/coop' as any)} style={[styles.communityBtn, styles.communityCoop]}>
              <Text style={styles.communityEmoji}>🤝</Text>
              <Text style={[styles.communityTitle, { color: '#00c853' }]}>Coop Pool</Text>
              <Text style={styles.communitySub}>Sell as one</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/sos' as any)} style={[styles.communityBtn, styles.communitySos]}>
              <Text style={styles.communityEmoji}>🆘</Text>
              <Text style={[styles.communityTitle, { color: '#ff3b5c' }]}>SOS</Text>
              <Text style={styles.communitySub}>Emergency</Text>
            </Pressable>
          </View>
        );

      case 'agronomist':
        return (
          <Animated.View entering={FadeInDown.delay(140).duration(550)}>
            <Pressable onPress={() => router.push('/voice' as any)} style={({ pressed }) => [styles.heroOuter, pressed && { opacity: 0.9 }]}>
              <LinearGradient colors={['#00cc6a', '#009e52', '#00582e']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBg}>
                <View style={styles.heroLeft}><Text style={styles.heroEmoji}>🧑‍🌾</Text></View>
                <View style={styles.heroRight}>
                  <View style={styles.heroBadgeRow}>
                    <View style={styles.heroDot} />
                    <Text style={styles.heroBadgeText}>LIVE</Text>
                  </View>
                  <Text style={styles.heroTitle}>GAIA Agronomist</Text>
                  <Text style={styles.heroSub}>Voice + chat · ask me anything</Text>
                </View>
                <View style={styles.heroArrowWrap}><Text style={styles.heroArrow}>›</Text></View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        );

      case 'section:diagnose': return renderSection(SECTIONS[0]);
      case 'section:my_farm':  return renderSection(SECTIONS[1]);
      case 'section:ai_tools': return renderSection(SECTIONS[2]);
      case 'section:market':   return renderSection(SECTIONS[3]);

      case 'admin':
        if (!isAdmin) return null;
        return (
          <Pressable onPress={() => router.push('/admin' as any)} style={styles.adminCard}>
            <Text style={styles.adminLabel}>ADMIN CONSOLE</Text>
            <Text style={styles.adminArrow}>›</Text>
          </Pressable>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.neon} />}
      >
        {/* EDIT toggle bar */}
        <View style={styles.topBar}>
          <View style={styles.flex1} />
          <Pressable
            onPress={() => setEditMode((v) => !v)}
            style={[styles.editToggle, editMode && { backgroundColor: '#00c853', borderColor: '#00c853' }]}
          >
            <Text style={[styles.editToggleTxt, editMode && { color: '#000' }]}>{editMode ? 'DONE' : 'EDIT LAYOUT'}</Text>
          </Pressable>
        </View>

        {editMode ? (
          <View style={styles.editBanner}>
            <Text style={styles.editBannerTxt}>
              Tap × to hide, ↑↓ to reorder any block. {saving ? 'Saving…' : 'Saved'}
            </Text>
            <Pressable onPress={resetPrefs} style={styles.resetBtn}>
              <Text style={styles.resetTxt}>RESET ALL</Text>
            </Pressable>
          </View>
        ) : null}

        {orderedBlocks.map((block, i) => {
          const content = renderBlock(block.id);
          if (!content) return null;
          return (
            <Block key={block.id} id={block.id} index={i} total={orderedBlocks.length}>
              {content}
            </Block>
          );
        })}

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

    topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    editToggle: {
      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
      backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    },
    editToggleTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: p.text },

    editBanner: {
      marginBottom: 14, padding: 12, borderRadius: 12,
      backgroundColor: 'rgba(0,200,83,0.1)',
      borderWidth: 1, borderColor: 'rgba(0,200,83,0.35)',
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    editBannerTxt: { flex: 1, fontSize: 11, color: '#00c853', fontWeight: '700' },
    resetBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,59,92,0.15)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.4)' },
    resetTxt: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#ff3b5c' },

    blockWrap: { position: 'relative' },
    blockBar: {
      flexDirection: 'row', alignItems: 'center',
      paddingHorizontal: 10, paddingVertical: 6, marginBottom: 6,
      backgroundColor: 'rgba(0,200,83,0.08)',
      borderWidth: 1, borderColor: 'rgba(0,200,83,0.3)', borderRadius: 10,
    },
    blockBarLabel: { flex: 1, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, color: '#00c853' },
    blockBarBtns: { flexDirection: 'row', gap: 6 },
    blockBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
    blockBtnTxt: { fontSize: 13, fontWeight: '900', color: '#fff' },

    // existing styles
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    greeting: { fontSize: 15, fontWeight: '500', color: p.textMuted },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
    name: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1.2, textTransform: 'capitalize', flexShrink: 1 },
    badgeChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    badgeChipTxt: { fontSize: 9, fontWeight: '900', color: '#000', letterSpacing: 1 },
    scanBadge: { width: 78, height: 78, borderRadius: 39, alignItems: 'center', justifyContent: 'center' },
    scanNum: { fontSize: 28, fontWeight: '900', color: p.obsidian },
    scanLbl: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: p.obsidian },

    planCard: { marginTop: 24, padding: 24, borderRadius: 22, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: p.border },
    planLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: p.textMuted },
    planValue: { fontSize: 22, fontWeight: '900', color: p.neon, marginTop: 2 },
    planBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, backgroundColor: p.neon },
    planBtnText: { fontSize: 11, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },

    walletCard: { marginTop: 16, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', flexDirection: 'row', alignItems: 'center' },
    walletKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(0,255,136,0.8)' },
    walletAcct: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 2, marginTop: 6 },
    walletBal: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
    walletBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: '#00ff88' },
    walletBtnTxt: { fontSize: 10, fontWeight: '900', color: '#000', letterSpacing: 1.2 },

    seasonOuter: { marginTop: 20, borderRadius: 24, overflow: 'hidden' },
    seasonBg: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24 },
    seasonLeft: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
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

    heroOuter: { marginTop: 20, borderRadius: 24, overflow: 'hidden' },
    heroBg: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, paddingHorizontal: 20, borderRadius: 24 },
    heroLeft: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center', marginRight: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
    heroEmoji: { fontSize: 34 },
    heroRight: { flex: 1 },
    heroBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    heroDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' },
    heroBadgeText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5, color: '#ffffff' },
    heroTitle: { fontSize: 20, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
    heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '500' },
    heroArrowWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
    heroArrow: { fontSize: 22, color: '#ffffff', fontWeight: '300', lineHeight: 24 },

    sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.5, color: p.textMuted, marginTop: 32, marginBottom: 12 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    tileOuter: { width: TILE_W, position: 'relative' },
    tilePress: { borderRadius: 22, overflow: 'hidden' },
    tile: { borderRadius: 22, overflow: 'hidden', height: 150, justifyContent: 'flex-end' },
    tileImage: { borderRadius: 22 },
    tileOverlay: { padding: 14 },
    tileTitle: { fontSize: 18, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
    tileSub: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    tileControls: { position: 'absolute', top: 8, right: 8, left: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    tileBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    tileBtnSmall: { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
    tileBtnTxt: { fontSize: 14, fontWeight: '900', color: '#fff' },
    moveGroup: { flexDirection: 'row' },

    adminCard: { marginTop: 24, padding: 16, borderRadius: 16, borderWidth: 1.5, borderColor: p.danger, backgroundColor: 'rgba(255,60,90,0.08)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    adminLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1.5, color: p.danger },
    adminArrow: { fontSize: 22, color: p.danger },

    spacer: { height: 140 },
  });
};
