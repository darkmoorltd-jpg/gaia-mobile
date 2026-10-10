import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

const STAGES = [
  { key: 'land',       label: 'Land' },
  { key: 'planting',   label: 'Planting' },
  { key: 'vegetative', label: 'Vegetative' },
  { key: 'flowering',  label: 'Flowering' },
  { key: 'fruiting',   label: 'Fruiting' },
  { key: 'maturity',   label: 'Maturity' },
  { key: 'harvest',    label: 'Harvest' },
  { key: 'postharvest',label: 'Post-harvest' },
];

const CHECKPOINTS = [
  { day: 14,   label: 'Seedling photo',   emoji: '🌱' },
  { day: 35,   label: 'Knee-high photo',  emoji: '🌿' },
  { day: 65,   label: 'Tasseling photo',  emoji: '🌾' },
  { day: 100,  label: 'Pre-harvest photo',emoji: '📸' },
];

function fmtN(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
function fmtDate(s?: string) { return s ? new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'; }

export default function Season() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [data, setData] = useState<any>(null);
  const [live, setLive] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);
  const [peer, setPeer] = useState<any>(null);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);
  const [briefPlaying, setBriefPlaying] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data: d } = await supabase.rpc('season_get_active');
    if (d?.active) {
      setData(d);
      // fetch peer compare
      const { data: pc } = await supabase.rpc('season_peer_compare', { p_season_id: d.season.id });
      setPeer(pc);
    } else {
      setData({ active: false });
    }
    setBusy(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const refreshLive = useCallback(async () => {
    if (!data?.active) return;
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const season = data.season;
      const events = (data.events || []).slice(0, 12).map((e: any) => ({
        kind: e.kind, label: e.label,
      }));
      const r = await fetch(API_BASE + '/season/live-value', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          season_id: season.id,
          crop: season.crop,
          stage: season.current_stage,
          days_since_planting: data.days_since_planting,
          days_to_harvest: data.days_to_harvest,
          plot_hectares: season.plot_hectares,
          state: null,
          recent_events: events,
          total_cost_naira: Number(data.cost_total || 0),
          language: 'en',
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setLive(j);
        // persist
        await supabase.rpc('season_set_live_value', {
          p_season_id: season.id,
          p_yield_kg: j.forecast_kg,
          p_price_per_kg: j.price_per_kg_naira,
          p_health: j.health_score,
          p_loss: j.loss_estimate_naira,
        });
      }

      // weather
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('farm_gps_lat,farm_gps_lon')
        .eq('user_id', user?.id).maybeSingle();
      if (prof?.farm_gps_lat && prof?.farm_gps_lon) {
        const wr = await fetch(API_BASE + '/season/weather', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lat: prof.farm_gps_lat, lng: prof.farm_gps_lon }),
        });
        if (wr.ok) setWeather(await wr.json());
      }
    } catch {}
  }, [data, user]);

  useEffect(() => { if (data?.active) refreshLive(); }, [data?.active, refreshLive]);

  const playBrief = () => {
    if (!live) return;
    const text = live.headline + '. ' + live.action;
    setBriefPlaying(true);
    try {
      Speech.stop();
      Speech.speak(text, {
        language: 'en-NG',
        pitch: 1.0,
        rate: 0.92,
        onDone: () => setBriefPlaying(false),
        onStopped: () => setBriefPlaying(false),
        onError: () => setBriefPlaying(false),
      });
    } catch { setBriefPlaying(false); }
  };

  if (busy && !data) return <View style={styles.center}><ActivityIndicator color={palette.neon} /></View>;

  if (!data?.active) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <LinearGradient colors={['#ffb300', '#ff8f00', '#e65100']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroStart}>
            <Text style={styles.heroKicker}>GAIA SEASON</Text>
            <Text style={styles.heroTitle}>Follow my crop</Text>
            <Text style={styles.heroSub}>
              Watch your investment grow every day. GAIA tracks costs, disease, weather,
              and market price — and tells you what your standing crop is worth right now.
            </Text>
          </LinearGradient>
          <Pressable onPress={() => router.push('/season-start' as any)} style={styles.ctaBtn}>
            <Text style={styles.ctaBtnText}>PLANT A SEASON</Text>
          </Pressable>
          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    );
  }

  const season = data.season;
  const stageIdx = STAGES.findIndex((s) => s.key === season.current_stage);
  const progress = Number(data.progress_pct || 0);
  const daysToHarvest = Number(data.days_to_harvest || 0);
  const daysSince = Number(data.days_since_planting || 0);
  const profit = Number(data.revenue_total || 0) - Number(data.cost_total || 0);
  const liveValue = live?.live_value_naira || Number(season.live_value_naira || 0);
  const health = live?.health_score ?? season.health_score ?? 75;
  const loss = live?.loss_estimate_naira || Number(season.loss_estimate_naira || 0);
  const forecastKg = live?.forecast_kg || season.latest_yield_forecast_kg || 0;

  const nextCheckpoint = CHECKPOINTS.find((c) => c.day > daysSince && (daysSince - c.day) > -2);

  const healthColor = health >= 80 ? '#00ff88' : health >= 60 ? '#ffb300' : '#ff3b5c';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); refreshLive(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        {/* ============================================ */}
        {/* LIVE VALUE HERO                              */}
        {/* ============================================ */}
        <LinearGradient
          colors={['#0a1f14', '#0d2b1a', '#0a1f14']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.liveHero}
        >
          <Text style={styles.liveKicker}>YOUR CROP IS WORTH</Text>
          <Text style={styles.liveValue}>{fmtN(liveValue)}</Text>
          <View style={styles.liveSubRow}>
            <View style={styles.liveSubItem}>
              <Text style={styles.liveSubVal}>{Number(forecastKg).toLocaleString()}</Text>
              <Text style={styles.liveSubLbl}>KG FORECAST</Text>
            </View>
            <View style={styles.liveSubItem}>
              <Text style={[styles.liveSubVal, { color: healthColor }]}>{health}</Text>
              <Text style={styles.liveSubLbl}>HEALTH</Text>
            </View>
            <View style={styles.liveSubItem}>
              <Text style={styles.liveSubVal}>{daysToHarvest > 0 ? daysToHarvest : '●'}</Text>
              <Text style={styles.liveSubLbl}>{daysToHarvest > 0 ? 'DAYS TO GO' : 'HARVEST'}</Text>
            </View>
          </View>
        </LinearGradient>

        {/* progress bar */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: progress + '%' }]} />
        </View>
        <Text style={styles.progressText}>
          {season.crop}{season.variety ? ' · ' + season.variety : ''} · Day {daysSince} · {progress}%
        </Text>

        {/* ============================================ */}
        {/* TODAY'S ACTION — voice brief                 */}
        {/* ============================================ */}
        {live ? (
          <Pressable onPress={playBrief} style={styles.briefCard}>
            <View style={styles.briefHeader}>
              <Text style={styles.briefLabel}>TODAY'S ACTION</Text>
              <View style={styles.briefVoiceBtn}>
                <Text style={styles.briefVoiceIcon}>{briefPlaying ? '🔊' : '🔈'}</Text>
                <Text style={styles.briefVoiceTxt}>{briefPlaying ? 'PLAYING' : 'TAP TO LISTEN'}</Text>
              </View>
            </View>
            <Text style={styles.briefHeadline}>{live.headline}</Text>
            <Text style={styles.briefAction}>→ {live.action}</Text>
          </Pressable>
        ) : (
          <View style={styles.briefCard}>
            <Text style={styles.briefLabel}>TODAY'S ACTION</Text>
            <ActivityIndicator color={palette.neon} style={{ marginTop: 8 }} />
          </View>
        )}

        {/* ============================================ */}
        {/* LOSS WARNING                                 */}
        {/* ============================================ */}
        {loss > 0 ? (
          <View style={styles.lossCard}>
            <Text style={styles.lossLabel}>AT-RISK REVENUE</Text>
            <Text style={styles.lossVal}>{fmtN(loss)}</Text>
            <Text style={styles.lossMeta}>
              Untreated disease/pest pressure. Spray to protect this value.
            </Text>
          </View>
        ) : null}

        {/* ============================================ */}
        {/* PEER COMPARISON                              */}
        {/* ============================================ */}
        {peer && peer.sample_size > 0 ? (
          <View style={styles.peerCard}>
            <Text style={styles.peerLabel}>VS NEIGHBOURS ({peer.sample_size} farms)</Text>
            <Text style={styles.peerText}>
              Your forecast is{' '}
              <Text style={{ color: peer.diff_pct >= 0 ? '#00ff88' : '#ff3b5c', fontWeight: '900' }}>
                {peer.diff_pct >= 0 ? '+' : ''}{peer.diff_pct}%
              </Text>
              {' '}vs the {season.crop} average in your state.
            </Text>
          </View>
        ) : null}

        {/* ============================================ */}
        {/* PHOTO CHECKPOINT                             */}
        {/* ============================================ */}
        {nextCheckpoint ? (
          <Pressable
            onPress={() => router.push(('/season-log?id=' + season.id) as any)}
            style={styles.checkpointCard}
          >
            <Text style={styles.checkpointEmoji}>{nextCheckpoint.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.checkpointLabel}>TIME FOR A PHOTO</Text>
              <Text style={styles.checkpointTitle}>{nextCheckpoint.label}</Text>
              <Text style={styles.checkpointSub}>GAIA will scan it for disease automatically.</Text>
            </View>
            <Text style={styles.checkpointArrow}>›</Text>
          </Pressable>
        ) : null}

        {/* ============================================ */}
        {/* WEATHER SNAPSHOT                             */}
        {/* ============================================ */}
        {weather?.days?.length ? (
          <View style={styles.weatherCard}>
            <Text style={styles.weatherLabel}>NEXT 14 DAYS</Text>
            <Text style={styles.weatherVal}>{weather.total_rain_14d_mm} mm rain</Text>
            <View style={styles.weatherBars}>
              {weather.days.slice(0, 7).map((d: any, i: number) => {
                const maxRain = Math.max(...weather.days.map((x: any) => x.rain_mm || 0), 1);
                const h = 6 + (d.rain_mm / maxRain) * 32;
                return (
                  <View key={i} style={styles.weatherBarCol}>
                    <View style={[styles.weatherBar, { height: h, backgroundColor: d.rain_mm > 0 ? '#4fc3f7' : 'rgba(255,255,255,0.15)' }]} />
                    <Text style={styles.weatherBarLbl}>{d.date.slice(-2)}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {/* ============================================ */}
        {/* STAGES                                       */}
        {/* ============================================ */}
        <Text style={styles.sectionLabel}>STAGE</Text>
        <View style={styles.stageGrid}>
          {STAGES.map((s, i) => {
            const active = s.key === season.current_stage;
            const done = i < stageIdx;
            return (
              <View key={s.key} style={[styles.stageChip, done && styles.stageDone, active && styles.stageActive]}>
                <Text style={[styles.stageText, done && styles.stageTextDone, active && styles.stageTextActive]}>
                  {done ? '✓ ' : active ? '● ' : ''}{s.label}
                </Text>
              </View>
            );
          })}
        </View>

        {/* ============================================ */}
        {/* MONEY                                       */}
        {/* ============================================ */}
        <View style={styles.kpiRow}>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtN(data.cost_total)}</Text>
            <Text style={styles.kpiLbl}>COST</Text>
          </View>
          <View style={styles.kpi}>
            <Text style={styles.kpiVal}>{fmtN(data.revenue_total)}</Text>
            <Text style={styles.kpiLbl}>REVENUE</Text>
          </View>
          <View style={[styles.kpi, profit >= 0 ? styles.kpiGood : styles.kpiBad]}>
            <Text style={[styles.kpiVal, { color: profit >= 0 ? '#00ff88' : '#ff3b5c' }]}>{fmtN(profit)}</Text>
            <Text style={styles.kpiLbl}>PROFIT</Text>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => router.push(('/season-log?id=' + season.id) as any)} style={[styles.actionBtn, { borderColor: palette.neon }]}>
            <Text style={[styles.actionTxt, { color: palette.neon }]}>LOG ACTIVITY</Text>
          </Pressable>
          <Pressable onPress={() => router.push(('/season-harvest?id=' + season.id) as any)} style={[styles.actionBtn, { borderColor: palette.warning }]}>
            <Text style={[styles.actionTxt, { color: palette.warning }]}>HARVEST</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionLabel}>TIMELINE</Text>
        {(data.events || []).length === 0 ? (
          <Text style={styles.kv}>No events logged yet.</Text>
        ) : (data.events || []).map((e: any, i: number) => (
          <View key={i} style={styles.eventRow}>
            <View style={styles.eventDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.eventLabel}>{e.label || e.kind}</Text>
              <Text style={styles.eventMeta}>
                {fmtDate(e.created_at)}
                {e.cost_naira > 0 ? ' · ' + fmtN(e.cost_naira) : ''}
              </Text>
            </View>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  center: { flex: 1, backgroundColor: p.obsidian, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },

  heroStart: { padding: 24, borderRadius: 24, marginBottom: 20 },
  heroKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.7)' },
  heroTitle: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -1, marginTop: 6 },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.9)', marginTop: 10, lineHeight: 19 },
  ctaBtn: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaBtnText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },

  liveHero: { padding: 24, borderRadius: 24, borderWidth: 1, borderColor: 'rgba(0,255,136,0.25)' },
  liveKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2.4, color: 'rgba(0,255,136,0.75)' },
  liveValue: { fontSize: 48, fontWeight: '900', color: '#00ff88', letterSpacing: -2, marginTop: 4 },
  liveSubRow: { flexDirection: 'row', marginTop: 18 },
  liveSubItem: { flex: 1 },
  liveSubVal: { fontSize: 16, fontWeight: '900', color: '#fff' },
  liveSubLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: 'rgba(255,255,255,0.5)', marginTop: 3 },

  progressBar: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: 14 },
  progressFill: { height: '100%', backgroundColor: '#00ff88', borderRadius: 3 },
  progressText: { fontSize: 11, color: p.textMuted, marginTop: 6, fontWeight: '700' },

  briefCard: { marginTop: 18, padding: 18, borderRadius: 18, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.28)' },
  briefHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  briefLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  briefVoiceBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  briefVoiceIcon: { fontSize: 14 },
  briefVoiceTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: 'rgba(0,255,136,0.75)' },
  briefHeadline: { fontSize: 17, fontWeight: '800', color: p.text, marginTop: 10, lineHeight: 24 },
  briefAction: { fontSize: 13, fontWeight: '700', color: '#00ff88', marginTop: 8 },

  lossCard: { marginTop: 14, padding: 16, borderRadius: 14, backgroundColor: 'rgba(255,59,92,0.06)', borderWidth: 1, borderColor: 'rgba(255,59,92,0.3)' },
  lossLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#ff3b5c' },
  lossVal: { fontSize: 24, fontWeight: '900', color: '#ff3b5c', letterSpacing: -0.8, marginTop: 4 },
  lossMeta: { fontSize: 11, color: p.textMuted, marginTop: 4 },

  peerCard: { marginTop: 14, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  peerLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 6 },
  peerText: { fontSize: 13, color: p.text, lineHeight: 19 },

  checkpointCard: { marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: 'rgba(179,136,255,0.08)', borderWidth: 1, borderColor: 'rgba(179,136,255,0.3)', flexDirection: 'row', alignItems: 'center', gap: 14 },
  checkpointEmoji: { fontSize: 32 },
  checkpointLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.6, color: '#b388ff' },
  checkpointTitle: { fontSize: 15, fontWeight: '900', color: p.text, marginTop: 3 },
  checkpointSub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  checkpointArrow: { fontSize: 24, color: '#b388ff', fontWeight: '300' },

  weatherCard: { marginTop: 14, padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  weatherLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted },
  weatherVal: { fontSize: 18, fontWeight: '900', color: '#4fc3f7', marginTop: 4 },
  weatherBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, marginTop: 12, height: 50 },
  weatherBarCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
  weatherBar: { width: '100%', borderRadius: 3 },
  weatherBarLbl: { fontSize: 9, color: p.textMuted, marginTop: 4, fontWeight: '700' },

  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 10 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  stageDone: { borderColor: 'rgba(0,255,136,0.3)', backgroundColor: 'rgba(0,255,136,0.06)' },
  stageActive: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.18)' },
  stageText: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  stageTextDone: { color: 'rgba(0,255,136,0.7)' },
  stageTextActive: { color: '#00ff88' },

  kpiRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiGood: { borderColor: 'rgba(0,255,136,0.3)' },
  kpiBad: { borderColor: 'rgba(255,59,92,0.3)' },
  kpiVal: { fontSize: 14, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },

  kv: { fontSize: 12, color: p.textMuted },
  eventRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.neon, marginTop: 5 },
  eventLabel: { fontSize: 13, fontWeight: '700', color: p.text },
  eventMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
});
