import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const BAND_COLORS: Record<string, [string, string]> = {
  bronze:   ['#cd7f32', '#8d5524'],
  silver:   ['#c0c0c0', '#808080'],
  gold:     ['#ffd700', '#c9a800'],
  platinum: ['#e5e4e2', '#8b8b8b'],
};

const BAND_EMOJI: Record<string, string> = {
  bronze: '🥉', silver: '🥈', gold: '🥇', platinum: '💎',
};

export default function Score() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [data, setData] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    // recompute then read
    await supabase.rpc('gaia_recompute_score', { target: null });
    const { data: d } = await supabase.rpc('gaia_my_score');
    setData(d);
    setBusy(false);
    setRef(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (busy && !data) return <View style={styles.center}><ActivityIndicator color="#00ff88" /></View>;
  if (!data) return <View style={styles.center}><Text style={styles.kv}>No score yet.</Text></View>;

  const bandColors = BAND_COLORS[data.band] || BAND_COLORS.bronze;
  const comps = data.components || {};

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor="#00ff88" />}
    >
      <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
      <Text style={styles.title}>Your GAIA Score</Text>
      <Text style={styles.sub}>One number that follows you everywhere.</Text>

      <LinearGradient colors={bandColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.scoreHero}>
        <Text style={styles.bandEmoji}>{BAND_EMOJI[data.band]}</Text>
        <Text style={styles.scoreVal}>{data.score}</Text>
        <Text style={styles.bandTxt}>{data.band.toUpperCase()}</Text>
        {data.total_state > 1 ? (
          <Text style={styles.rankTxt}>
            Rank #{data.rank_state} of {data.total_state} in your state
          </Text>
        ) : null}
      </LinearGradient>

      <Text style={styles.sectionLabel}>HOW YOU EARN IT</Text>

      <ComponentRow label="Consistency" value={comps.consistency} max={100}
        detail={`${comps.scans || 0} scans logged`} palette={palette} styles={styles} />
      <ComponentRow label="Season performance" value={comps.performance} max={100}
        detail={comps.completed > 0 ? `${comps.completed} completed · avg profit N${(comps.avg_profit_naira || 0).toLocaleString()}` : 'Complete a season to boost this'}
        palette={palette} styles={styles} />
      <ComponentRow label="Disease response" value={comps.response} max={100}
        detail="Spray after disease/pest = higher"
        palette={palette} styles={styles} />
      <ComponentRow label="Marketplace reputation" value={comps.reputation} max={100}
        detail={`${comps.listings || 0} listings`}
        palette={palette} styles={styles} />
      <ComponentRow label="30-day engagement" value={comps.engagement} max={100}
        detail={`${comps.days_active_30d || 0} active days`}
        palette={palette} styles={styles} />

      <View style={styles.boostCard}>
        <Text style={styles.boostLabel}>BOOST YOUR SCORE</Text>
        <Text style={styles.boostText}>
          Log a scan today (+2) · Complete a season (+8) · Spray after disease (+3) · List on marketplace (+6)
        </Text>
      </View>

      <View style={styles.benefitsCard}>
        <Text style={styles.benefitsLabel}>WHAT IT UNLOCKS</Text>
        <Text style={styles.benefitsRow}>•  Silver+ → priority support</Text>
        <Text style={styles.benefitsRow}>•  Gold+ →  lower interest rates on loans</Text>
        <Text style={styles.benefitsRow}>•  Platinum →  ₦2M+ credit limit eligibility</Text>
        <Text style={styles.benefitsRow}>•  All bands →  show to lenders and coops</Text>
      </View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function ComponentRow({ label, value, max, detail, palette, styles }: any) {
  const pct = Math.min(100, Math.max(0, ((value || 0) / max) * 100));
  const color = pct >= 75 ? '#00ff88' : pct >= 50 ? '#ffb300' : '#ff6b35';
  return (
    <View style={styles.compRow}>
      <View style={styles.compHeader}>
        <Text style={styles.compLabel}>{label}</Text>
        <Text style={[styles.compVal, { color }]}>{value || 0}</Text>
      </View>
      <View style={styles.compBar}>
        <View style={[styles.compFill, { width: pct + '%', backgroundColor: color }]} />
      </View>
      <Text style={styles.compDetail}>{detail}</Text>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 },
  kv: { fontSize: 12, color: p.textMuted },

  scoreHero: { padding: 32, borderRadius: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  bandEmoji: { fontSize: 42 },
  scoreVal: { fontSize: 88, fontWeight: '900', color: '#000', letterSpacing: -4, marginTop: 4 },
  bandTxt: { fontSize: 12, fontWeight: '900', letterSpacing: 3, color: '#000', opacity: 0.8 },
  rankTxt: { fontSize: 11, fontWeight: '700', color: 'rgba(0,0,0,0.7)', marginTop: 10 },

  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 12 },
  compRow: { padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  compHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  compLabel: { fontSize: 13, fontWeight: '800', color: p.text },
  compVal: { fontSize: 18, fontWeight: '900' },
  compBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  compFill: { height: '100%', borderRadius: 3 },
  compDetail: { fontSize: 10, color: p.textMuted, marginTop: 6 },

  boostCard: { marginTop: 20, padding: 18, borderRadius: 16, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)' },
  boostLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88', marginBottom: 8 },
  boostText: { fontSize: 12, color: p.text, lineHeight: 18 },

  benefitsCard: { marginTop: 14, padding: 18, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  benefitsLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 10 },
  benefitsRow: { fontSize: 12, color: p.text, lineHeight: 20, marginBottom: 4 },
});
