import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';

const API_BASE = 'https://gaia-api-xuly.onrender.com';

interface Q {
  id: string;
  q: string;
  options: { label: string; score: number }[];
}

const QUESTIONS: Q[] = [
  {
    id: 'moisture',
    q: 'After drying, what is the grain moisture level?',
    options: [
      { label: 'Below 13% (dry, cracks when bitten)', score: 0 },
      { label: '13% to 15% (cool, no clumping)', score: 1 },
      { label: 'Above 15% (feels damp, clumps together)', score: 2 },
    ],
  },
  {
    id: 'drying_delay',
    q: 'How many days between harvest and proper drying?',
    options: [
      { label: 'Same day or next day', score: 0 },
      { label: '2 to 3 days', score: 1 },
      { label: 'More than 3 days', score: 2 },
    ],
  },
  {
    id: 'storage',
    q: 'How is the grain stored?',
    options: [
      { label: 'Hermetic bag (PICS, GrainPro, or airtight drum)', score: 0 },
      { label: 'Well-sealed plastic bags in a dry room', score: 1 },
      { label: 'Open sacks, woven bags, or floor pile', score: 2 },
    ],
  },
  {
    id: 'drought',
    q: 'Did the crop suffer drought while the grain was filling?',
    options: [
      { label: 'No, rain was steady', score: 0 },
      { label: 'Some dry spells (1–2 weeks)', score: 1 },
      { label: 'Severe drought (over 3 weeks)', score: 2 },
    ],
  },
  {
    id: 'insects',
    q: 'Were the cobs or grain damaged by insects before storage?',
    options: [
      { label: 'No visible damage', score: 0 },
      { label: 'Some holes, weevils, or borers', score: 1 },
      { label: 'Heavy damage on many cobs', score: 2 },
    ],
  },
  {
    id: 'humidity',
    q: 'What is the storage climate?',
    options: [
      { label: 'Dry savannah (Kano, Sokoto, Maiduguri)', score: 0 },
      { label: 'Middle belt (Kaduna, Jos, Abuja)', score: 1 },
      { label: 'Humid south (Lagos, Port Harcourt, Enugu)', score: 2 },
    ],
  },
];

function classify(score: number) {
  if (score <= 3) return { level: 'LOW', color: '#00ff88', emoji: '✓' };
  if (score <= 7) return { level: 'MEDIUM', color: '#ffb300', emoji: '!' };
  return { level: 'HIGH', color: '#ff3b5c', emoji: '⚠' };
}

export default function Aflatoxin() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const answered = Object.keys(answers).length;
  const total = QUESTIONS.length;
  const totalScore = Object.values(answers).reduce((a, b) => a + b, 0);
  const risk = classify(totalScore);

  const submit = async () => {
    if (answered < total) {
      Alert.alert('Missing answers', `Please answer all ${total} questions.`);
      return;
    }
    setBusy(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const t = session?.access_token;
      if (!t) throw new Error('Not authenticated');

      const summary = QUESTIONS.map((q) => {
        const idx = answers[q.id];
        return `- ${q.q}: ${q.options[idx].label}`;
      }).join('\n');

      const prompt = `A Nigerian farmer just scored ${totalScore}/12 on aflatoxin risk (${risk.level}).

Their answers:
${summary}

Give them a bold, specific plan to eliminate aflatoxin risk THIS SEASON. Structure:

## Your Risk Level: ${risk.level}
2 sentences — what this score means and what it costs them if ignored (liver cancer risk, rejected exports, price cuts).

## What Causes Aflatoxin
3 sentences — Aspergillus fungus, why it matters, how it spreads.

## DO THIS TODAY
Numbered 5 steps. Specific actions + exact products + Naira costs.

## The Cheap Fix (Under ₦3,000)
If they have small money — the one high-ROI action (probably proper drying + Aflasafe).

## Aflasafe Schedule
If applicable to their crop: exact rate (10 kg/ha), 3 weeks before flowering, Naira cost.

## Storage Rules
Hermetic bags, moisture meter, pallets, ventilation. Exact specs.

## Testing & Selling
How to test for aflatoxin cheaply, how to prove clean grain to buyers, price premium for clean stock.

## Cost Breakdown
Table: Item | Qty | Naira.

## Prevention Next Season
6 bullets — harvest timing, drying, insect control, drought care.

Rules: Naira costs, Nigerian product names, speak to farmer, bold key terms, no filler, never mention AI.`;

      const r = await fetch(`${API_BASE}/agronomist/text`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: prompt, history: [] }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setAdvice(data.answer || '(no response)');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>SAFETY CHECK</Text>
        <Text style={styles.title}>Aflatoxin Risk</Text>
        <Text style={styles.sub}>
          6 questions. 60 seconds. Know if your grain is safe to eat or sell.
        </Text>

        <View style={styles.progressRow}>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${(answered / total) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>{answered}/{total}</Text>
        </View>

        {advice ? (
          <>
            <LinearGradient colors={[risk.color, risk.color + 'aa'] as any} style={styles.riskHero}>
              <Text style={styles.riskIcon}>{risk.emoji}</Text>
              <Text style={styles.riskLabel}>{risk.level} RISK</Text>
              <Text style={styles.riskScore}>Score: {totalScore}/12</Text>
            </LinearGradient>

            <View style={styles.adviceCard}>
              <MarkdownOutput content={advice} />
            </View>

            <Pressable onPress={() => { setAdvice(null); setAnswers({}); }} style={styles.resetBtn}>
              <Text style={styles.resetText}>CHECK ANOTHER BATCH</Text>
            </Pressable>
          </>
        ) : (
          <>
            {QUESTIONS.map((q, qi) => (
              <View key={q.id} style={styles.qCard}>
                <Text style={styles.qNum}>QUESTION {qi + 1} OF {total}</Text>
                <Text style={styles.qText}>{q.q}</Text>
                {q.options.map((opt, oi) => {
                  const selected = answers[q.id] === oi;
                  return (
                    <Pressable
                      key={oi}
                      onPress={() => setAnswers({ ...answers, [q.id]: oi })}
                      style={[styles.optBtn, selected && styles.optBtnOn]}
                    >
                      <View style={[styles.radio, selected && styles.radioOn]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                      <Text style={[styles.optText, selected && styles.optTextOn]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ))}

            {answered === total ? (
              <Pressable onPress={submit} disabled={busy} style={styles.cta}>
                {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>GET MY RISK REPORT</Text>}
              </Pressable>
            ) : (
              <Text style={styles.pendingHint}>
                Answer all {total} questions to continue
              </Text>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 18, lineHeight: 18 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 18 },
  progressBg: { flex: 1, height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3 },
  progressFill: { height: '100%', backgroundColor: p.neon, borderRadius: 3 },
  progressText: { fontSize: 11, color: p.textMuted, fontWeight: '800' },
  qCard: {
    padding: 16, marginBottom: 14, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
  },
  qNum: { fontSize: 9, fontWeight: '900', letterSpacing: 1.8, color: p.neon },
  qText: { fontSize: 15, fontWeight: '700', color: p.text, marginTop: 6, marginBottom: 12, lineHeight: 21 },
  optBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, marginBottom: 8, borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1, borderColor: p.border,
  },
  optBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)' },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: p.textDim,
    alignItems: 'center', justifyContent: 'center',
  },
  radioOn: { borderColor: p.neon },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: p.neon },
  optText: { flex: 1, fontSize: 13, color: p.textMuted, lineHeight: 18 },
  optTextOn: { color: p.text, fontWeight: '600' },
  cta: {
    padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 12,
  },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  pendingHint: { fontSize: 12, color: p.textDim, textAlign: 'center', marginTop: 12, fontStyle: 'italic' },
  riskHero: {
    borderRadius: 24, padding: 28, alignItems: 'center', marginBottom: 20,
  },
  riskIcon: { fontSize: 48, color: '#000', fontWeight: '900' },
  riskLabel: { fontSize: 24, fontWeight: '900', color: '#000', letterSpacing: 2, marginTop: 8 },
  riskScore: { fontSize: 14, fontWeight: '800', color: 'rgba(0,0,0,0.65)', marginTop: 4 },
  adviceCard: {
    padding: 16, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 16,
  },
  resetBtn: {
    padding: 16, borderRadius: 12,
    borderWidth: 1.5, borderColor: p.borderHi, alignItems: 'center',
  },
  resetText: { fontSize: 12, fontWeight: '900', letterSpacing: 1, color: p.neon },
});
