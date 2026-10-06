import { useState } from 'react';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';
const num = (n: any, dp: number = 0) => Number(n || 0).toLocaleString('en-NG', { maximumFractionDigits: dp });
const fmtN = (n: any) => {
  const x = Number(n || 0);
  const abs = Math.abs(x);
  const sign = x < 0 ? '-' : '';
  if (abs >= 1e9) return sign + 'N' + (abs / 1e9).toFixed(2) + 'B';
  if (abs >= 1e6) return sign + 'N' + (abs / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return sign + 'N' + (abs / 1e3).toFixed(0) + 'K';
  return sign + 'N' + abs.toFixed(0);
};

interface Policy {
  key: string;
  label: string;
  desc: string;
  color: string;
  magnitudeLabel: string;
  magnitudeMin: number;
  magnitudeMax: number;
  magnitudeDefault: number;
}

const POLICIES: Policy[] = [
  { key: 'expand_credit', label: 'Expand Credit', desc: 'Reach X% more farmers with financing',
    color: '#4fc3f7', magnitudeLabel: '% more farmers', magnitudeMin: 5, magnitudeMax: 100, magnitudeDefault: 20 },
  { key: 'extension_officers', label: 'Extension Officers', desc: 'Deploy X officers to worst LGAs',
    color: '#00ff88', magnitudeLabel: 'Officers deployed', magnitudeMin: 5, magnitudeMax: 500, magnitudeDefault: 50 },
  { key: 'new_seed', label: 'New Seed Variety', desc: 'Adopt to X% of farmers',
    color: '#b388ff', magnitudeLabel: '% of farmers', magnitudeMin: 5, magnitudeMax: 100, magnitudeDefault: 30 },
  { key: 'cut_subsidy', label: 'Cut Subsidy', desc: 'Reduce fertilizer subsidy by X%',
    color: '#ff3b5c', magnitudeLabel: '% subsidy cut', magnitudeMin: 5, magnitudeMax: 80, magnitudeDefault: 30 },
];

export default function MinistryPolicySimulator() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [policyKey, setPolicyKey] = useState<string>('expand_credit');
  const [magnitude, setMagnitude] = useState<number>(20);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const policy = POLICIES.find(p => p.key === policyKey)!;

  const run = async () => {
    setBusy(true);
    setResult(null);
    const r = await supabase.rpc('ministry_policy_simulator', {
      p_policy: policyKey,
      p_target: null,
      p_magnitude: magnitude,
    });
    setBusy(false);
    if (r.error) {
      Alert.alert('Simulation failed', r.error.message);
      return;
    }
    setResult(r.data);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Policy Simulator</Text>
        <Text style={styles.sub}>Test a policy against real farm data before committing budget</Text>

        <Text style={styles.sectionLabel}>CHOOSE POLICY</Text>
        {POLICIES.map(p => (
          <Pressable
            key={p.key}
            onPress={() => {
              setPolicyKey(p.key);
              setMagnitude(p.magnitudeDefault);
              setResult(null);
            }}
            style={[styles.policyCard, policyKey === p.key && { borderColor: p.color, backgroundColor: p.color + '10' }]}
          >
            <View style={[styles.policyDot, { backgroundColor: p.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.policyLabel, policyKey === p.key && { color: p.color }]}>{p.label}</Text>
              <Text style={styles.policyDesc}>{p.desc}</Text>
            </View>
          </Pressable>
        ))}

        <Text style={styles.sectionLabel}>{policy.magnitudeLabel.toUpperCase()}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.valueBig, { color: policy.color }]}>{num(magnitude)}</Text>
        </View>
        <View style={styles.stepRow}>
          {[0, 1, 2, 3].map(i => {
            const range = policy.magnitudeMax - policy.magnitudeMin;
            const v = policy.magnitudeMin + Math.round(range * i / 3);
            return (
              <Pressable
                key={i}
                onPress={() => setMagnitude(v)}
                style={[styles.stepBtn, magnitude === v && { borderColor: policy.color, backgroundColor: policy.color + '20' }]}
              >
                <Text style={[styles.stepText, magnitude === v && { color: policy.color }]}>{num(v)}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sliderRow}>
          <Pressable onPress={() => setMagnitude(Math.max(policy.magnitudeMin, magnitude - Math.round((policy.magnitudeMax - policy.magnitudeMin) / 20)))} style={styles.sliderBtn}>
            <Text style={styles.sliderBtnText}>−</Text>
          </Pressable>
          <Pressable onPress={() => setMagnitude(Math.min(policy.magnitudeMax, magnitude + Math.round((policy.magnitudeMax - policy.magnitudeMin) / 20)))} style={styles.sliderBtn}>
            <Text style={styles.sliderBtnText}>+</Text>
          </Pressable>
        </View>

        <Pressable onPress={run} disabled={busy} style={[styles.runBtn, busy && { opacity: 0.5 }, { backgroundColor: policy.color }]}>
          {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.runBtnText}>RUN SIMULATION</Text>}
        </Pressable>

        {result ? (
          <View style={styles.result}>
            <Text style={styles.resultTitle}>SIMULATION RESULT</Text>

            <View style={styles.resultHero}>
              <Text style={styles.resultHeroLabel}>YIELD UPLIFT (RANGE)</Text>
              <Text style={styles.resultHeroVal}>
                {num(result.uplift_tonnes_low, 1)} → {num(result.uplift_tonnes_high, 1)} t
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>Value at market</Text>
              <Text style={[styles.resultVal, { color: '#00ff88' }]}>
                {fmtN(result.uplift_value_low_naira)} → {fmtN(result.uplift_value_high_naira)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>Program cost</Text>
              <Text style={[styles.resultVal, { color: result.cost_naira < 0 ? '#00ff88' : '#ff3b5c' }]}>
                {fmtN(result.cost_naira)}
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>ROI (low → high)</Text>
              <Text style={styles.resultVal}>
                {result.roi_low != null ? Number(result.roi_low).toFixed(2) : '—'} → {result.roi_high != null ? Number(result.roi_high).toFixed(2) : '—'}×
              </Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>Farmers affected</Text>
              <Text style={styles.resultVal}>{num(result.affected_farmers)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>Hectares affected</Text>
              <Text style={styles.resultVal}>{num(result.affected_hectares, 1)}</Text>
            </View>
            <View style={styles.resultRow}>
              <Text style={styles.resultLbl}>Baseline production</Text>
              <Text style={styles.resultVal}>{num(result.baseline_tonnes)} t</Text>
            </View>

            <View style={styles.confidenceNote}>
              <Text style={styles.confidenceText}>
                Confidence: {String(result.confidence).toUpperCase()}. Model uses real GAIA farm data across the active book.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginTop: 20, marginBottom: 8 },
  policyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1.5, borderColor: p.border },
  policyDot: { width: 10, height: 10, borderRadius: 5 },
  policyLabel: { fontSize: 14, fontWeight: '900', color: p.text },
  policyDesc: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  valueRow: { alignItems: 'center', marginBottom: 12 },
  valueBig: { fontSize: 44, fontWeight: '900', letterSpacing: -2 },
  stepRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  stepBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  stepText: { fontSize: 11, fontWeight: '900', color: p.textMuted },
  sliderRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  sliderBtn: { flex: 1, padding: 16, borderRadius: 12, borderWidth: 1.5, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  sliderBtnText: { fontSize: 22, fontWeight: '900', color: p.text, lineHeight: 24 },
  runBtn: { padding: 20, borderRadius: 14, alignItems: 'center' },
  runBtnText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1.5 },
  result: { marginTop: 24, padding: 20, borderRadius: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border },
  resultTitle: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.textMuted, marginBottom: 16 },
  resultHero: { padding: 18, borderRadius: 14, backgroundColor: 'rgba(0,255,136,0.08)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', marginBottom: 16 },
  resultHeroLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted },
  resultHeroVal: { fontSize: 24, fontWeight: '900', color: '#00ff88', letterSpacing: -0.8, marginTop: 6 },
  resultRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  resultLbl: { fontSize: 12, color: p.textMuted },
  resultVal: { fontSize: 13, fontWeight: '800', color: p.text },
  confidenceNote: { marginTop: 16, padding: 12, borderRadius: 10, backgroundColor: 'rgba(255,179,0,0.06)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.25)' },
  confidenceText: { fontSize: 11, color: '#ffb300', lineHeight: 16 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
