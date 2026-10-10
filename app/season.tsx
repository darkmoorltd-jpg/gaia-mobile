import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Alert,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const API_BASE = 'https://gaia-api-xuly.onrender.com';

const STAGES = [
  { key: 'land',       label: 'Land prep' },
  { key: 'planting',   label: 'Planting' },
  { key: 'vegetative', label: 'Vegetative' },
  { key: 'flowering',  label: 'Flowering' },
  { key: 'fruiting',   label: 'Fruiting' },
  { key: 'maturity',   label: 'Maturity' },
  { key: 'harvest',    label: 'Harvest' },
  { key: 'postharvest',label: 'Post-harvest' },
];

function fmtN(n: any) { return 'N' + Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 }); }
function fmtDate(s?: string) { return s ? new Date(s).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : '—'; }

export default function Season() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [data, setData] = useState<any>(null);
  const [brief, setBrief] = useState<any>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    const { data: d, error } = await supabase.rpc('season_get_active');
    if (!error && d?.active) setData(d);
    else setData({ active: false });
    setBusy(false);
    setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const loadBrief = async () => {
    if (!data?.active || briefLoading) return;
    setBriefLoading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess?.session?.access_token;
      const season = data.season;
      const events = (data.events || []).slice(0, 8).map((e: any) => ({
        day: Math.floor((Date.now() - new Date(e.created_at).getTime()) / 86400000),
        label: e.label || e.kind,
      }));
      const r = await fetch(API_BASE + '/season/daily-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: 'Bearer ' + token } : {}),
        },
        body: JSON.stringify({
          crop: season.crop,
          stage: season.current_stage,
          days_since_planting: data.days_since_planting,
          days_to_harvest: data.days_to_harvest,
          state: user?.user_metadata?.state || null,
          language: 'en',
          recent_events: events,
          total_cost_naira: Number(data.cost_total || 0),
        }),
      });
      if (r.ok) {
        const j = await r.json();
        setBrief(j);
      }
    } catch {}
    setBriefLoading(false);
  };

  useEffect(() => { if (data?.active) loadBrief(); }, [data?.active]);

  if (busy && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={palette.neon} />
      </View>
    );
  }

  if (!data?.active) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <LinearGradient
            colors={['#0a0e0c', '#101815', '#0a0e0c']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroKicker}>GAIA SEASON</Text>
            <Text style={styles.heroTitle}>Start your season</Text>
            <Text style={styles.heroSub}>
              GAIA follows your crop from planting to harvest — every action, every naira,
              every risk. At the end, you get a report you can show a lender.
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
  const profit = Number(data.revenue_total || 0) - Number(data.cost_total || 0);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>

        <LinearGradient
          colors={['#00c853', '#009e52', '#00582e']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>ACTIVE SEASON</Text>
          <Text style={styles.heroTitle}>{season.crop}{season.variety ? ' · ' + season.variety : ''}</Text>
          <Text style={styles.heroSub}>
            Planted {fmtDate(season.planting_date)} · Day {data.days_since_planting}
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: progress + '%' }]} />
          </View>
          <Text style={styles.progressText}>
            {progress}% complete
            {daysToHarvest > 0 ? ' · ' + daysToHarvest + ' days to harvest' : ' · harvest window open'}
          </Text>
        </LinearGradient>

        {brief ? (
          <View style={styles.briefCard}>
            <Text style={styles.briefLabel}>TODAY'S ACTION</Text>
            <Text style={styles.briefAction}>{brief.action}</Text>
            {brief.reasoning ? (
              <Text style={styles.briefReason}>{brief.reasoning}</Text>
            ) : null}
          </View>
        ) : briefLoading ? (
          <View style={styles.briefCard}>
            <Text style={styles.briefLabel}>TODAY'S ACTION</Text>
            <ActivityIndicator color={palette.neon} style={{ marginTop: 8 }} />
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>STAGE</Text>
        <View style={styles.stageGrid}>
          {STAGES.map((s, i) => {
            const active = s.key === season.current_stage;
            const done = i < stageIdx;
            return (
              <View
                key={s.key}
                style={[
                  styles.stageChip,
                  done && styles.stageDone,
                  active && styles.stageActive,
                ]}
              >
                <Text style={[
                  styles.stageText,
                  done && styles.stageTextDone,
                  active && styles.stageTextActive,
                ]}>
                  {done ? '✓ ' : active ? '● ' : ''}{s.label}
                </Text>
              </View>
            );
          })}
        </View>

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
            <Text style={[styles.kpiVal, { color: profit >= 0 ? '#00ff88' : '#ff3b5c' }]}>
              {fmtN(profit)}
            </Text>
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
  hero: { padding: 22, borderRadius: 22, borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', marginBottom: 16 },
  heroKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.6)' },
  heroTitle: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.8, marginTop: 4 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.25)', overflow: 'hidden', marginTop: 16 },
  progressFill: { height: '100%', backgroundColor: '#fff', borderRadius: 4 },
  progressText: { fontSize: 10, color: 'rgba(255,255,255,0.7)', marginTop: 6, fontWeight: '700' },
  ctaBtn: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 20 },
  ctaBtnText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
  briefCard: { padding: 18, borderRadius: 18, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.28)', marginBottom: 20 },
  briefLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  briefAction: { fontSize: 16, fontWeight: '800', color: p.text, marginTop: 8, lineHeight: 22 },
  briefReason: { fontSize: 12, color: p.textMuted, marginTop: 6, lineHeight: 17, fontStyle: 'italic' },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 12, marginBottom: 10 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 20 },
  stageChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  stageDone: { borderColor: 'rgba(0,255,136,0.3)', backgroundColor: 'rgba(0,255,136,0.06)' },
  stageActive: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.18)' },
  stageText: { fontSize: 11, fontWeight: '700', color: p.textMuted },
  stageTextDone: { color: 'rgba(0,255,136,0.7)' },
  stageTextActive: { color: '#00ff88' },
  kpiRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  kpi: { flex: 1, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kpiGood: { borderColor: 'rgba(0,255,136,0.3)' },
  kpiBad: { borderColor: 'rgba(255,59,92,0.3)' },
  kpiVal: { fontSize: 14, fontWeight: '900', color: p.text },
  kpiLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.2, color: p.textMuted, marginTop: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  actionBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center' },
  actionTxt: { fontSize: 11, fontWeight: '900', letterSpacing: 1.3 },
  kv: { fontSize: 12, color: p.textMuted },
  eventRow: { flexDirection: 'row', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  eventDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.neon, marginTop: 5 },
  eventLabel: { fontSize: 13, fontWeight: '700', color: p.text },
  eventMeta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
});
