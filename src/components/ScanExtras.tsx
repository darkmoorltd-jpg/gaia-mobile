import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme';
import { supabase } from '../api/supabase';
import { logTreatment } from '../utils/scanLog';

export function FarmScoreCard({ onPress }: { onPress?: () => void }) {
  const { palette } = useTheme();
  const styles = makeScoreStyles(palette);
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await supabase.rpc('user_farm_score');
      setData(data || null);
    } catch (e) { console.warn(e); }
    setBusy(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  if (busy) return <View style={styles.card}><ActivityIndicator color={palette.neon} /></View>;
  if (!data) return null;

  const score = data.score ?? 0;
  const tier = String(data.tier || 'starter').toUpperCase();
  const tierColor = ({
    ELITE: '#ffd700', TOP: '#00c853', ACTIVE: '#4fc3f7',
    DEVELOPING: '#ffb300', STARTER: '#8899a6',
  } as any)[tier] || palette.neon;

  return (
    <Pressable onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kicker}>FARM HEALTH SCORE</Text>
          <Text style={styles.score}>{score}<Text style={styles.scoreMax}>/1000</Text></Text>
          <Text style={[styles.tier, { color: tierColor }]}>{tier}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          {data.loan_eligible ? <Text style={[styles.badge, styles.badgeGood]}>LOAN READY</Text> : null}
          {data.insurance_eligible ? <Text style={[styles.badge, styles.badgeBlue]}>INSURABLE</Text> : null}
        </View>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: Math.min(100, score / 10) + '%', backgroundColor: tierColor }]} />
      </View>
      <Text style={styles.next}>{data.next_action || ''}</Text>
    </Pressable>
  );
}

const COMMON_TREATMENTS = [
  'Mancozeb', 'Copper hydroxide', 'Neem oil',
  'Emamectin benzoate', 'Cypermethrin', 'Metalaxyl', 'Other',
];

interface TreatmentPanelProps {
  diseaseLabel: string;
  scanId: string;
  hasTreatment: boolean;
  onTreatmentLogged?: () => void;
}

export function TreatmentPanel({ diseaseLabel, scanId, hasTreatment, onTreatmentLogged }: TreatmentPanelProps) {
  const { palette } = useTheme();
  const styles = makeTreatmentStyles(palette);
  const [rankings, setRankings] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [localHas, setLocalHas] = useState(hasTreatment);
  const [showPicker, setShowPicker] = useState(false);

  const load = useCallback(async () => {
    if (!diseaseLabel) { setBusy(false); return; }
    setBusy(true);
    try {
      const { data } = await supabase.rpc('treatment_effectiveness', { p_disease: diseaseLabel, p_days: 90 });
      setRankings(Array.isArray(data) ? data : []);
    } catch (e) { console.warn(e); }
    setBusy(false);
  }, [diseaseLabel]);

  useEffect(() => { load(); }, [load]);

  const applyTreatment = async (product: string) => {
    setShowPicker(false);
    const ok = await logTreatment(scanId, { product, applied_at: new Date().toISOString() });
    if (ok) {
      setLocalHas(true);
      await load();
      onTreatmentLogged?.();
    }
  };

  return (
    <View>
      <Text style={styles.sectionLabel}>HOW OTHERS TREATED THIS</Text>

      {!localHas ? (
        <>
          <Text style={styles.hint}>What did you do for this?</Text>
          {!showPicker ? (
            <Pressable onPress={() => setShowPicker(true)} style={styles.cta}>
              <Text style={styles.ctaText}>Log your treatment</Text>
            </Pressable>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {COMMON_TREATMENTS.map((t) => (
                <Pressable key={t} onPress={() => applyTreatment(t)} style={styles.pill}>
                  <Text style={styles.pillText}>{t}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </>
      ) : null}

      {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 12 }} /> : null}

      {!busy && rankings.length === 0 ? (
        <Text style={styles.hint}>
          No other farmers have logged treatments for {diseaseLabel} yet. Be the first.
        </Text>
      ) : rankings.map((r, i) => {
        const pct = r.success_pct ?? 0;
        const color = pct >= 70 ? '#00ff88' : pct >= 40 ? '#ffb300' : '#ff3b5c';
        return (
          <View key={i} style={styles.rankRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.product}>{r.product}</Text>
              <Text style={styles.meta}>
                {r.improved} improved · {r.worsened} worsened · {r.total} total
              </Text>
            </View>
            <Text style={[styles.pct, { color }]}>{pct}%</Text>
          </View>
        );
      })}
    </View>
  );
}

const makeScoreStyles = (p: any) => StyleSheet.create({
  card: { padding: 18, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  kicker: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted },
  score: { fontSize: 42, fontWeight: '900', color: p.neon, letterSpacing: -2, marginTop: 4 },
  scoreMax: { fontSize: 16, color: p.textDim, fontWeight: '400' },
  tier: { fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginTop: 4 },
  badge: { fontSize: 9, fontWeight: '900', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5, marginBottom: 4, overflow: 'hidden' },
  badgeGood: { backgroundColor: 'rgba(0,255,136,0.15)', color: '#00ff88' },
  badgeBlue: { backgroundColor: 'rgba(79,195,247,0.15)', color: '#4fc3f7' },
  progressBar: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.06)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  next: { fontSize: 11, color: p.textMuted, marginTop: 10, fontStyle: 'italic' },
});

const makeTreatmentStyles = (p: any) => StyleSheet.create({
  sectionLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.neon, marginTop: 22, marginBottom: 10 },
  hint: { fontSize: 12, color: p.textMuted, marginBottom: 8, lineHeight: 18 },
  cta: { padding: 12, borderRadius: 10, backgroundColor: p.neon, alignItems: 'center', marginTop: 4 },
  ctaText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  pillText: { fontSize: 12, color: p.text },
  rankRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  product: { fontSize: 14, fontWeight: '700', color: p.text },
  meta: { fontSize: 10, color: p.textMuted, marginTop: 2 },
  pct: { fontSize: 18, fontWeight: '900' },
});
