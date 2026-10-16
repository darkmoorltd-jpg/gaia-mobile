import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Alert,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, typography } from '../../src/theme';
import { useAuth } from '../../src/store/auth';
import WeatherWidget from '../../src/components/WeatherWidget';
import StreakWidget from '../../src/components/StreakWidget';
import RadialFAB from '../../src/components/RadialFAB';
import DashboardWidget from '../../src/components/DashboardWidget';
import WidgetLibraryModal from '../../src/components/WidgetLibraryModal';
import { loadLayout, saveLayout, defaultLayout, Widget, WIDGET_REGISTRY } from '../../src/utils/dashboardLayout';
import { tap as hapticTap } from '../../src/utils/haptics';

export default function Dashboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const scansRemaining = useAuth((s: any) => s.scansRemaining);
  const plan = useAuth((s: any) => s.plan);

  const [layout, setLayout] = useState<Widget[]>([]);
  const [editing, setEditing] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const reload = useCallback(async () => {
    const l = await loadLayout(user?.id);
    setLayout(l);
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
    Alert.alert('Reset dashboard', 'Restore the default layout?', [
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
        cta="Open marketplace"
        accent={palette.warning}
        onPress={() => router.push('/marketplace' as any)} palette={palette} />;
      case 'voice':        return <FeatureCard
        icon={'\uD83C\uDF99\uFE0F'} title="Voice Agronomist"
        body="Ask GAIA anything about your crops — in English, Hausa, Yoruba, Igbo or Pidgin."
        cta="Talk to GAIA"
        accent={'#00bcd4'}
        onPress={() => router.push('/(tabs)/voice' as any)} palette={palette} />;
      case 'satellite':    return <FeatureCard
        icon={'\uD83D\uDEF0\uFE0F'} title="Satellite Monitor"
        body="See how healthy your fields look from space. Track NDVI over time."
        cta="Check my fields"
        accent={'#7c4dff'}
        onPress={() => router.push('/(tabs)/satellite' as any)} palette={palette} />;
      case 'help':         return <FeatureCard
        icon={'\uD83C\uDD98'} title="Help & Support"
        body="Questions? Open a ticket and the GAIA team will reply within 24 hours."
        cta="Open support"
        accent={'#ff3b5c'}
        onPress={() => router.push('/(tabs)/help' as any)} palette={palette} />;
      default: return null;
    }
  };

  if (busy) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={palette.neon} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); reload(); }} tintColor={palette.neon} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.kicker}>DASHBOARD</Text>
            <Text style={styles.title}>GAIA</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {editing ? (
              <>
                <Pressable onPress={() => { hapticTap(); setShowPicker(true); }} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>+ ADD</Text>
                </Pressable>
                <Pressable onPress={reset} style={styles.headerBtn}>
                  <Text style={styles.headerBtnText}>{'\u21BA'}</Text>
                </Pressable>
              </>
            ) : null}
            <Pressable
              onPress={() => { hapticTap(); setEditing((e) => !e); }}
              style={[styles.headerBtn, editing && styles.headerBtnActive]}
            >
              <Text style={[styles.headerBtnText, editing && { color: '#000' }]}>
                {editing ? 'DONE' : 'EDIT'}
              </Text>
            </Pressable>
          </View>
        </View>

        {editing ? (
          <View style={styles.editHint}>
            <Text style={styles.editHintText}>
              Use { '\u2191\u2193' } to reorder, X to hide. Tap + ADD for more.
            </Text>
          </View>
        ) : null}

        {enabled.map((w, i) => (
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
        ))}

        {!editing && enabled.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Your dashboard is empty</Text>
            <Text style={styles.emptyBody}>Tap EDIT above to add widgets.</Text>
          </View>
        ) : null}

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
// WIDGETS
// ============================================================

function Greeting() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
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
  const styles = createStyles(palette);
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
  const styles = createStyles(palette);
  const items = [
    { emoji: '\uD83C\uDF3F', label: 'Crops',   route: '/(tabs)/crops' },
    { emoji: '\uD83D\uDC1B', label: 'Pests',   route: '/(tabs)/pests' },
    { emoji: '\uD83C\uDFE0', label: 'Soil',    route: '/(tabs)/soil' },
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
  const styles = createStyles(palette);
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
  const styles = createStyles(palette);
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

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 40 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end',
    marginBottom: 18,
  },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.neon },
  title: { fontSize: 34, fontWeight: '900', letterSpacing: -1, color: p.text, marginTop: 2 },
  headerBtn: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.neon, alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: { backgroundColor: p.neon },
  headerBtnText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, color: p.neon },
  editHint: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)', marginBottom: 16,
  },
  editHintText: { fontSize: 12, color: p.neon, fontWeight: '600', textAlign: 'center' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: p.text },
  emptyBody: { fontSize: 13, color: p.textMuted, marginTop: 8, textAlign: 'center' },
  greetWrap: { paddingVertical: 6 },
  greetSmall: { fontSize: 14, color: p.textMuted, fontWeight: '600', letterSpacing: 0.4 },
  greetBig: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -0.6, textTransform: 'capitalize', marginTop: 2 },
  scansCard: {
    padding: 18, borderRadius: 18, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border,
  },
  scansLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  scansBig: { fontSize: 40, fontWeight: '900', color: p.neon, letterSpacing: -1, marginTop: 4 },
  scansPlan: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  scansBarWrap: {
    height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)',
    marginTop: 12, overflow: 'hidden',
  },
  scansBarFill: { height: 6, backgroundColor: p.neon },
  qaRow: { flexDirection: 'row', gap: 10 },
  qaBtn: {
    flex: 1, paddingVertical: 16, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  qaEmoji: { fontSize: 24 },
  qaLabel: { fontSize: 10, fontWeight: '800', color: p.text, letterSpacing: 0.5 },
  tipCard: {
    padding: 18, borderRadius: 18, backgroundColor: p.surface,
    borderWidth: 1, borderColor: p.border, borderLeftWidth: 4, borderLeftColor: '#ffd700',
  },
  tipLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: '#ffd700', marginBottom: 6 },
  tipBody: { fontSize: 13, color: p.text, lineHeight: 20 },
  featureCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    padding: 18, borderRadius: 18, backgroundColor: p.surface,
    borderWidth: 1.5,
  },
  featureIcon: { fontSize: 30 },
  featureTitle: { fontSize: 15, fontWeight: '900', letterSpacing: 0.4 },
  featureBody: { fontSize: 12, color: p.textMuted, marginTop: 4, lineHeight: 18 },
  featureCta: { fontSize: 12, fontWeight: '800', marginTop: 10, letterSpacing: 0.5 },
});
