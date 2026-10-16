import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  RefreshControl, ActivityIndicator, Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import { supabase } from '../../src/api/supabase';
import WeatherWidget from '../../src/components/WeatherWidget';
import StreakWidget from '../../src/components/StreakWidget';
import RadialFAB from '../../src/components/RadialFAB';
import DashboardWidget from '../../src/components/DashboardWidget';
import WidgetLibraryModal from '../../src/components/WidgetLibraryModal';
import { loadLayout, saveLayout, defaultLayout, Widget } from '../../src/utils/dashboardLayout';
import { tap as hapticTap } from '../../src/utils/haptics';

export default function Dashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const plan = useAuth((s: any) => s.plan);

  if (!user) return null;

  const _hour = new Date().getHours();
  const heroGreeting = _hour < 12 ? 'Good morning' : _hour < 17 ? 'Good afternoon' : 'Good evening';
  const _rawName = (user.email || 'farmer').split('@')[0];
  const heroName = _rawName.charAt(0).toUpperCase() + _rawName.slice(1);

  // Theme toggle
  if (!(globalThis as any).__gaiaTheme) (globalThis as any).__gaiaTheme = 'light';
  const [theme, setTheme] = useState<'light' | 'dark'>((globalThis as any).__gaiaTheme);
  const dark = theme === 'dark';
  const setMode = (d: boolean) => {
    hapticTap();
    const next = d ? 'dark' : 'light';
    (globalThis as any).__gaiaTheme = next;
    setTheme(next);
  };

  // Widget layout
  const [layout, setLayout] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);

  const reload = useCallback(async () => {
    const l = await loadLayout(user?.id);
    setLayout(l);
    try {
      if (user?.id) {
        const { data } = await supabase
          .from('farmer_wallets')
          .select('balance')
          .eq('user_id', user.id)
          .maybeSingle();
        setWalletBalance(Number(data?.balance || 0));
      }
    } catch {}
    setBusy(false);
    setRef(false);
  }, [user?.id]);

  useEffect(() => { reload(); }, [reload]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const persist = (next: Widget[]) => {
    setLayout(next);
    saveLayout(user?.id, next).catch(() => {});
  };

  const move = (id: string, dir: -1 | 1) => {
    hapticTap();
    const enabled = layout.filter((w) => w.enabled);
    const disabled = layout.filter((w) => !w.enabled);
    const idx = enabled.findIndex((w) => w.id === id);
    if (idx < 0) return;
    const j = idx + dir;
    if (j < 0 || j >= enabled.length) return;
    const next = [...enabled];
    [next[idx], next[j]] = [next[j], next[idx]];
    persist([...next, ...disabled]);
  };

  const toggle = (id: string, enabled: boolean) => {
    persist(layout.map((w) => (w.id === id ? { ...w, enabled } : w)));
  };

  const reset = () => {
    Alert.alert('Reset widgets', 'Restore the default widget list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: () => persist(defaultLayout()) },
    ]);
  };

  const enabled = layout.filter((w) => w.enabled);

  const renderWidget = (w: Widget) => {
    switch (w.id) {
      case 'greeting':     return <Greeting />;
      case 'weather':      return <WeatherWidget />;
      case 'streak':       return <StreakWidget />;
      case 'scans':        return <ScansCard scans={scansRemaining} plan={plan} />;
      case 'quickActions': return <QuickActions onNav={(r) => router.push(r as any)} palette={palette} />;
      case 'tips':         return <FarmingTip palette={palette} />;
      case 'marketplace':  return <FeatureCard
        icon={'\uD83D\uDED2'} title="Marketplace"
        body="Buy and sell farm produce. Fresh listings from farmers near you."
        cta="Open marketplace" accent={palette.warning}
        onPress={() => router.push('/marketplace' as any)} palette={palette} />;
      case 'voice':        return <FeatureCard
        icon={'\uD83C\uDF99\uFE0F'} title="Voice Agronomist"
        body="Ask GAIA anything about your crops — in English, Hausa, Yoruba, Igbo or Pidgin."
        cta="Talk to GAIA" accent={'#00bcd4'}
        onPress={() => router.push('/(tabs)/voice' as any)} palette={palette} />;
      case 'satellite':    return <FeatureCard
        icon={'\uD83D\uDEF0\uFE0F'} title="Satellite Monitor"
        body="See how healthy your fields look from space. Track NDVI over time."
        cta="Check my fields" accent={'#7c4dff'}
        onPress={() => router.push('/(tabs)/satellite' as any)} palette={palette} />;
      case 'help':         return <FeatureCard
        icon={'\uD83C\uDD98'} title="Help & Support"
        body="Questions? Open a ticket and the GAIA team will reply within 24 hours."
        cta="Open support" accent={'#ff3b5c'}
        onPress={() => router.push('/(tabs)/help' as any)} palette={palette} />;
      default: return null;
    }
  };

  const styles = createStyles(palette, dark);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); reload(); }} tintColor="#00c853" />}
        showsVerticalScrollIndicator={false}
      >
        {/* Theme toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>{dark ? '🌙' : '☀️'}</Text>
          <Pressable onPress={() => setMode(!dark)} style={styles.toggleBtn}>
            <View style={[styles.toggleKnob, dark && styles.toggleKnobOn]} />
          </Pressable>
        </View>

        {/* ============ HERO ============ */}
        <Text style={styles.heroTitle}>GAIA</Text>
        <Text style={styles.subtitle}>Global Agricultural Intelligence Assistant</Text>

        <View style={styles.imageWrap}>
          <Image
            source={{ uri: 'https://images.unsplash.com/photo-1556801712-76c8eb07bbc9?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }}
            style={styles.heroImage}
          />
        </View>

        <View style={styles.statRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>10+</Text>
            <Text style={styles.statLabel}>Crop Models</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>99.5%</Text>
            <Text style={styles.statLabel}>Top Accuracy</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>152</Text>
            <Text style={styles.statLabel}>Classes</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>24/7</Text>
            <Text style={styles.statLabel}>Offline Ready</Text>
          </View>
        </View>

        {/* ============ HERO — ALWAYS VISIBLE ============ */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <Text style={styles.heroGreetSmall}>{heroGreeting},</Text>
            <Text style={styles.heroGreetBig}>{heroName}</Text>
          </View>
          <View style={styles.heroStats}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatVal}>{scansRemaining}</Text>
              <Text style={styles.heroStatLbl}>SCANS LEFT</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatVal, { fontSize: 15 }]}>
                {String(plan || 'free').toUpperCase()}
              </Text>
              <Text style={styles.heroStatLbl}>PLAN</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroStat}>
              <Text style={[styles.heroStatVal, { fontSize: 15 }]}>
                {'\u20A6' + Number(walletBalance).toLocaleString()}
              </Text>
              <Text style={styles.heroStatLbl}>WALLET</Text>
            </View>
          </View>
        </View>

        {/* ============ CUSTOMIZABLE WIDGETS ============ */}
        <View style={styles.widgetHeader}>
          <Text style={styles.widgetHeaderTitle}>MY WIDGETS</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { hapticTap(); setShowPicker(true); }} style={styles.widgetBtn}>
                  <Text style={styles.widgetBtnText}>+ ADD</Text>
                </Pressable>
                <Pressable onPress={reset} style={styles.widgetBtn}>
                  <Text style={styles.widgetBtnText}>{'\u21BA'}</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() => { hapticTap(); setEditing((e) => !e); }}
              style={[styles.widgetBtn, editing && styles.widgetBtnActive]}
            >
              <Text style={[styles.widgetBtnText, editing && { color: '#000' }]}>
                {editing ? 'DONE' : 'EDIT'}
              </Text>
            </Pressable>
          </View>
        </View>

        {editing ? (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              {'\u2191\u2193'} to reorder, X to hide, + ADD for more widgets
            </Text>
          </View>
        ) : null}

        {busy ? (
          <ActivityIndicator color={palette.neon} style={{ marginVertical: 20 }} />
        ) : enabled.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No widgets</Text>
            <Text style={styles.emptyBody}>Tap EDIT above to add widgets.</Text>
          </View>
        ) : (
          enabled.map((w, i) => (
            <DashboardWidget
              key={w.id}
              id={w.id}
              editing={editing}
              canUp={i > 0}
              canDown={i < enabled.length - 1}
              onUp={() => move(w.id, -1)}
              onDown={() => move(w.id, 1)}
              onRemove={() => toggle(w.id, false)}
            >
              {renderWidget(w)}
            </DashboardWidget>
          ))
        )}

        {/* ============ FOOTER ============ */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Powered by <Text style={styles.footerBold}>Darkmoor Ltd</Text>
          </Text>
          <Text style={styles.footerEmail}>darkmoorltd@gmail.com</Text>
        </View>

        <View style={{ height: 140 }} />
      </ScrollView>

      <RadialFAB />

      <WidgetLibraryModal
        visible={showPicker}
        layout={layout}
        onToggle={toggle}
        onClose={() => setShowPicker(false)}
      />
    </View>
  );
}

// ============================================================
// WIDGET COMPONENTS
// ============================================================

function Greeting() {
  const { palette } = useTheme();
  const styles = createStyles(palette, false);
  const user = useAuth((s: any) => s.user);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const raw = (user?.email || 'farmer').split('@')[0];
  const name = raw.charAt(0).toUpperCase() + raw.slice(1);
  return (
    <View style={styles.greetWrap}>
      <Text style={styles.greetSmall}>{greet},</Text>
      <Text style={styles.greetBig}>{name}</Text>
    </View>
  );
}

function ScansCard({ scans, plan }: any) {
  const { palette } = useTheme();
  const styles = createStyles(palette, false);
  const total = 30;
  const pct = Math.max(0, Math.min(1, scans / Math.max(scans, total)));
  return (
    <View style={styles.scansCard}>
      <View style={{ flex: 1 }}>
        <Text style={styles.scansLabel}>SCANS REMAINING</Text>
        <Text style={styles.scansBig}>{scans}</Text>
        <Text style={styles.scansPlan}>Plan: {String(plan || 'free').toUpperCase()}</Text>
      </View>
      <View style={styles.scansBarWrap}>
        <View style={[styles.scansBarFill, { width: (pct * 100) + '%' }]} />
      </View>
    </View>
  );
}

function QuickActions({ onNav, palette }: any) {
  const styles = createStyles(palette, false);
  const items = [
    { emoji: '\uD83C\uDF3F', label: 'Crops',     route: '/(tabs)/crops' },
    { emoji: '\uD83D\uDC1B', label: 'Pests',     route: '/(tabs)/pests' },
    { emoji: '\uD83C\uDFE0', label: 'Soil',      route: '/(tabs)/soil' },
    { emoji: '\uD83D\uDC04', label: 'Livestock', route: '/(tabs)/livestock' },
  ];
  return (
    <View style={styles.qaRow}>
      {items.map((it) => (
        <Pressable
          key={it.label}
          onPress={() => { hapticTap(); onNav(it.route); }}
          style={styles.qaBtn}
        >
          <Text style={styles.qaEmoji}>{it.emoji}</Text>
          <Text style={styles.qaLabel}>{it.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FarmingTip({ palette }: any) {
  const styles = createStyles(palette, false);
  const tips = [
    'Spray herbicides early morning or late evening — wind is calmer.',
    'Add organic mulch to keep soil moist through the dry spell.',
    'Rotate maize with legumes next season to restore nitrogen.',
    'Inspect leaf undersides weekly — most pests hide there.',
    'Dry maize to 13% moisture before storage to prevent aflatoxin.',
    'Add lime to acidic soil — ask GAIA for the exact rate.',
  ];
  const day = new Date().getDate();
  const tip = tips[day % tips.length];
  return (
    <View style={styles.tipCard}>
      <Text style={styles.tipLabel}>{'\uD83D\uDCA1'} TIP OF THE DAY</Text>
      <Text style={styles.tipBody}>{tip}</Text>
    </View>
  );
}

function FeatureCard({ icon, title, body, cta, accent, onPress, palette }: any) {
  const styles = createStyles(palette, false);
  return (
    <Pressable onPress={() => { hapticTap(); onPress(); }} style={[styles.featureCard, { borderColor: accent }]}>
      <Text style={styles.featureIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.featureTitle, { color: accent }]}>{title}</Text>
        <Text style={styles.featureBody}>{body}</Text>
        <Text style={[styles.featureCta, { color: accent }]}>{cta} {'\u203A'}</Text>
      </View>
    </Pressable>
  );
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (p: any, dark: boolean) => {
  const bg = dark
    ? 'linear-gradient' // placeholder; RN doesn't support CSS gradient in StyleSheet
    : undefined;
  const surface = dark ? 'rgba(255,255,255,0.05)' : '#ffffff';
  const text = dark ? '#ffffff' : '#1b5e20';
  const textMuted = dark ? '#b0bec5' : '#558b2f';

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: dark ? '#0f2027' : '#e8f5e9' },
    scroll: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

    toggleRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 8 },
    toggleLabel: { fontSize: 16 },
    toggleBtn: {
      width: 46, height: 26, borderRadius: 13,
      backgroundColor: dark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
      justifyContent: 'center', padding: 3,
    },
    toggleKnob: {
      width: 20, height: 20, borderRadius: 10,
      backgroundColor: dark ? '#00c853' : '#2e7d32',
      marginLeft: dark ? 20 : 0,
    },
    toggleKnobOn: {},

    heroTitle: {
      fontSize: 68, fontWeight: '900', textAlign: 'center',
      color: '#00c853', letterSpacing: -1,
      textShadowColor: 'rgba(0,200,83,0.5)', textShadowRadius: 18,
      textShadowOffset: { width: 0, height: 0 },
      marginTop: 4,
    },
    subtitle: { textAlign: 'center', fontSize: 15, color: textMuted, marginBottom: 18 },
    imageWrap: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
    heroImage: { width: '100%', height: 190, backgroundColor: '#111' },

    statRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
    statItem: {
      flex: 1, paddingVertical: 14, paddingHorizontal: 6,
      backgroundColor: surface, borderRadius: 14,
      alignItems: 'center', justifyContent: 'center',
    },
    statNumber: { fontSize: 20, fontWeight: '900', color: '#00c853', letterSpacing: -0.5 },
    statLabel: { fontSize: 10, color: textMuted, marginTop: 3, fontWeight: '600', textAlign: 'center' },

    widgetHeader: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 12, marginBottom: 12,
    },
    widgetHeaderTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: textMuted },
    widgetBtn: {
      paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
      borderWidth: 1.5, borderColor: '#00c853', alignItems: 'center', justifyContent: 'center',
    },
    widgetBtnActive: { backgroundColor: '#00c853' },
    widgetBtnText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#00c853' },
    editHint: {
      paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
      backgroundColor: 'rgba(0,200,83,0.08)',
      borderWidth: 1, borderColor: 'rgba(0,200,83,0.25)', marginBottom: 14,
    },
    editHintText: { fontSize: 11, color: '#00c853', fontWeight: '600', textAlign: 'center' },

    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '900', color: text },
    emptyBody: { fontSize: 12, color: textMuted, marginTop: 6 },

    heroCard: {
      padding: 20, borderRadius: 20, backgroundColor: surface,
      borderWidth: 1, borderColor: 'rgba(0,200,83,0.25)',
      marginBottom: 20,
    },
    heroTop: { marginBottom: 16 },
    heroGreetSmall: { fontSize: 13, color: textMuted, fontWeight: '600' },
    heroGreetBig: {
      fontSize: 28, fontWeight: '900', color: text,
      marginTop: 2, textTransform: 'capitalize',
    },
    heroStats: { flexDirection: 'row', alignItems: 'center' },
    heroStat: { flex: 1, alignItems: 'center' },
    heroStatVal: {
      fontSize: 22, fontWeight: '900', color: '#00c853', letterSpacing: -0.5,
    },
    heroStatLbl: {
      fontSize: 9, color: textMuted, marginTop: 3,
      fontWeight: '800', letterSpacing: 1.2,
    },
    heroDivider: { width: 1, height: 34, backgroundColor: 'rgba(0,0,0,0.08)' },

    greetWrap: { paddingVertical: 4 },
    greetSmall: { fontSize: 13, color: textMuted, fontWeight: '600' },
    greetBig: { fontSize: 26, fontWeight: '900', color: text, marginTop: 2, textTransform: 'capitalize' },
    scansCard: { padding: 18, borderRadius: 18, backgroundColor: surface, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    scansLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: textMuted },
    scansBig: { fontSize: 36, fontWeight: '900', color: '#00c853', letterSpacing: -1, marginTop: 4 },
    scansPlan: { fontSize: 11, color: textMuted, marginTop: 2 },
    scansBarWrap: { height: 6, borderRadius: 3, backgroundColor: 'rgba(0,0,0,0.08)', marginTop: 12, overflow: 'hidden' },
    scansBarFill: { height: 6, backgroundColor: '#00c853' },
    qaRow: { flexDirection: 'row', gap: 8 },
    qaBtn: { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: surface, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
    qaEmoji: { fontSize: 22 },
    qaLabel: { fontSize: 10, fontWeight: '800', color: text },
    tipCard: { padding: 16, borderRadius: 16, backgroundColor: surface, borderLeftWidth: 4, borderLeftColor: '#ffd700' },
    tipLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#ffd700', marginBottom: 6 },
    tipBody: { fontSize: 13, color: text, lineHeight: 20 },
    featureCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 16, borderRadius: 16, backgroundColor: surface, borderWidth: 1.5 },
    featureIcon: { fontSize: 28 },
    featureTitle: { fontSize: 14, fontWeight: '900' },
    featureBody: { fontSize: 12, color: textMuted, marginTop: 4, lineHeight: 18 },
    featureCta: { fontSize: 12, fontWeight: '800', marginTop: 10 },

    footer: { alignItems: 'center', marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.08)' },
    footerText: { fontSize: 12, color: textMuted },
    footerBold: { fontWeight: '900', color: text },
    footerEmail: { fontSize: 11, color: '#00c853', marginTop: 4, fontWeight: '700' },
  });
};
