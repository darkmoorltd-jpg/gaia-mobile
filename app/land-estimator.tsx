import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Speech from 'expo-speech';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';
import { MarkdownOutput } from '../src/components/MarkdownOutput';
import CountUp from '../src/components/CountUp';
import ConfettiBurst from '../src/components/ConfettiBurst';
import { success as hapticSuccess, tap as hapticTap, bump as hapticBump, warn as hapticWarn } from '../src/utils/haptics';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const ACRE_M2 = 4046.86;
const HECTARE_M2 = 10000;
const PLOT_M2 = 648;
const FOOTBALL_M2 = 7140;

const CROPS = [
  { key: 'maize',     label: 'Maize',     emoji: '🌽', seed_kg: 10, npk_kg: 80,  urea_kg: 40, plants: 25000,  yield_lo: 1.5, yield_hi: 3.0,  price: 350000 },
  { key: 'rice',      label: 'Rice',      emoji: '🌾', seed_kg: 40, npk_kg: 90,  urea_kg: 45, plants: 100000, yield_lo: 2.0, yield_hi: 4.5,  price: 650000 },
  { key: 'beans',     label: 'Beans',     emoji: '🫘', seed_kg: 20, npk_kg: 30,  urea_kg: 0,  plants: 60000,  yield_lo: 0.6, yield_hi: 1.2,  price: 850000 },
  { key: 'cassava',   label: 'Cassava',   emoji: '🥔', seed_kg: 0,  npk_kg: 60,  urea_kg: 0,  plants: 4000,   yield_lo: 8.0, yield_hi: 15.0, price: 120000 },
  { key: 'tomato',    label: 'Tomato',    emoji: '🍅', seed_kg: 1,  npk_kg: 100, urea_kg: 30, plants: 6000,   yield_lo: 6.0, yield_hi: 12.0, price: 400000 },
  { key: 'sorghum',   label: 'Sorghum',   emoji: '🌾', seed_kg: 6,  npk_kg: 60,  urea_kg: 30, plants: 40000,  yield_lo: 1.0, yield_hi: 2.0,  price: 350000 },
  { key: 'millet',    label: 'Millet',    emoji: '🌾', seed_kg: 5,  npk_kg: 40,  urea_kg: 20, plants: 50000,  yield_lo: 0.8, yield_hi: 1.5,  price: 400000 },
  { key: 'groundnut', label: 'Groundnut', emoji: '🥜', seed_kg: 30, npk_kg: 20,  urea_kg: 0,  plants: 40000,  yield_lo: 0.7, yield_hi: 1.5,  price: 900000 },
];

const PRICE = { npk: 35000, urea: 32000 };

const LANGUAGES = [
  { key: 'en-NG', label: 'English' },
  { key: 'ha-NG', label: 'Hausa' },
  { key: 'yo-NG', label: 'Yoruba' },
  { key: 'ig-NG', label: 'Igbo' },
  { key: 'pcm-NG', label: 'Pidgin' },
];

type Unit = 'm' | 'ft';
type Mode = 'rect' | 'custom';
type Lang = 'en-NG' | 'ha-NG' | 'yo-NG' | 'ig-NG' | 'pcm-NG';

export default function LandEstimator() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [mode, setMode] = useState<Mode>('rect');
  const [unit, setUnit] = useState<Unit>('m');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [crop, setCrop] = useState(CROPS[0].key);
  const [price, setPrice] = useState('');
  const [language, setLanguage] = useState<Lang>('en-NG');
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [confettiFire, setConfettiFire] = useState(false);
  const lastAreaRef = useRef(0);

  const computeArea = () => {
    let sqm = 0;
    if (mode === 'rect') {
      const L = parseFloat(length);
      const W = parseFloat(width);
      if (!L || !W || L <= 0 || W <= 0) return null;
      const Lm = unit === 'm' ? L : L * 0.3048;
      const Wm = unit === 'm' ? W : W * 0.3048;
      sqm = Lm * Wm;
    } else {
      const a = parseFloat(customArea);
      if (!a || a <= 0) return null;
      sqm = a;
    }
    if (sqm <= 0) return null;
    return {
      sqm,
      acres: sqm / ACRE_M2,
      hectares: sqm / HECTARE_M2,
      plots: sqm / PLOT_M2,
      pitches: sqm / FOOTBALL_M2,
    };
  };

  const area = computeArea();
  const cropMeta = CROPS.find((c) => c.key === crop)!;

  useEffect(() => {
    try {
      if (area && lastAreaRef.current === 0) {
        hapticSuccess();
        setConfettiFire(true);
        setTimeout(() => setConfettiFire(false), 1600);
      }
      lastAreaRef.current = area ? area.sqm : 0;
    } catch (e) {
      console.log('confetti trigger failed', e);
    }
  }, [area?.sqm]);

  const projectInputs = area ? {
    seed_kg: +(cropMeta.seed_kg * area.acres).toFixed(1),
    npk_kg: +(cropMeta.npk_kg * area.acres).toFixed(1),
    urea_kg: +(cropMeta.urea_kg * area.acres).toFixed(1),
    plants: Math.round(cropMeta.plants * area.acres),
    npk_bags: Math.ceil((cropMeta.npk_kg * area.acres) / 50),
    urea_bags: Math.ceil((cropMeta.urea_kg * area.acres) / 50),
  } : null;

  const totalCost = projectInputs
    ? projectInputs.npk_bags * PRICE.npk + projectInputs.urea_bags * PRICE.urea
    : 0;

  const priceNum = parseFloat(price) || cropMeta.price;

  const yields = area ? {
    lo:  +(area.acres * cropMeta.yield_lo).toFixed(1),
    mid: +(area.acres * (cropMeta.yield_lo + cropMeta.yield_hi) / 2).toFixed(1),
    hi:  +(area.acres * cropMeta.yield_hi).toFixed(1),
  } : null;

  const revenue = yields ? {
    lo:  Math.round(yields.lo * priceNum),
    mid: Math.round(yields.mid * priceNum),
    hi:  Math.round(yields.hi * priceNum),
  } : null;

  const profitMid = revenue ? revenue.mid - totalCost : 0;

  const askAdvice = async () => {
    if (!area) return;
    setBusy(true);
    setAdvice(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const t = session?.access_token;
      if (!t) throw new Error('Please sign in again');

      const message = `A Nigerian farmer owns ${area.acres.toFixed(2)} acres (${area.hectares.toFixed(2)} hectares, about ${area.plots.toFixed(1)} traditional plots) of land.

Planning to plant ${cropMeta.label}.

Estimated inputs:
- Seed: ${projectInputs?.seed_kg} kg
- NPK 15:15:15: ${projectInputs?.npk_kg} kg (${projectInputs?.npk_bags} bags of 50 kg)
- Urea: ${projectInputs?.urea_kg} kg (${projectInputs?.urea_bags} bags of 50 kg)
- Plants / stands: about ${projectInputs?.plants.toLocaleString()}

Estimated input cost: ${totalCost.toLocaleString()} Naira.

Give me a comprehensive, well-formatted plan with these EXACT sections (use markdown headings):

## 1. Farm Verdict
Is ${area.acres.toFixed(2)} acres viable for ${cropMeta.label}? Commercial or subsistence?

## 2. Shopping List
Exact quantities and Naira price per item. Where to buy in Nigeria.

## 3. Seed Rate & Spacing
Spacing in cm, seeds per hole, thinning plan.

## 4. Fertilizer Schedule
When to apply NPK (basal), when to top-dress Urea, how to split.

## 5. Yield Expectation
Realistic tonnes per acre. Cash value at the current price of ${priceNum.toLocaleString()} Naira per tonne.

## 6. Cost-Benefit
Use bullet points, not tables. List:
- Total input cost
- Expected revenue
- Expected profit

## 7. The Trick
One non-obvious technique that boosts yield on this exact plot size.

## 8. Labour Plan
Land prep, planting, weeding, harvest. Workers, days, Naira cost.

## 9. Next Step
If they want to double income, what to plant next on this land.

Rules: Use Naira amounts. Nigerian context. Bold key terms. Never mention AI, Groq, DeepSeek. Speak directly to the farmer. Use short paragraphs, not walls of text.`;

      const r = await fetch(API_BASE + '/chat', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, language, history: [] }),
      });
      if (!r.ok) throw new Error('Server error (' + r.status + ')');
      const data = await r.json();
      const reply = data.reply || data.answer || '';
      if (!reply) throw new Error('Empty response');
      setAdvice(reply);
      hapticSuccess();
    } catch (e: any) {
      Alert.alert('Could not reach GAIA', e.message || 'Try again');
      hapticWarn();
    } finally {
      setBusy(false);
    }
  };

  const speakAdvice = async () => {
    if (!advice) return;
    if (speaking) {
      try { await Speech.stop(); } catch {}
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    hapticTap();
    const clean = advice
      .replace(/[#*_`]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);
    try {
      Speech.speak(clean, {
        language: language === 'pcm-NG' ? 'en-NG' : language,
        pitch: 1.0,
        rate: 0.95,
        onDone: () => setSpeaking(false),
        onStopped: () => setSpeaking(false),
        onError: () => setSpeaking(false),
      });
    } catch {
      setSpeaking(false);
    }
  };

  const saveAsFarm = async () => {
    if (!area || !user) {
      Alert.alert('Please sign in');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          farm_size_acres: +area.acres.toFixed(2),
          primary_crops: cropMeta.label,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id);
      if (error) throw error;
      hapticSuccess();
      setConfettiFire(true);
      setTimeout(() => setConfettiFire(false), 1600);
      Alert.alert(
        'Saved',
        area.acres.toFixed(2) + ' acres of ' + cropMeta.label + ' saved to your profile. It now feeds your calendar, yield estimates, and insurance quotes.'
      );
    } catch (e: any) {
      Alert.alert('Save failed', e.message || 'Try again');
    } finally {
      setSaving(false);
    }
  };

  const sharePlan = async () => {
    if (!advice || !area) return;
    try {
      hapticTap();
      await Share.share({
        title: 'GAIA Farm Plan - ' + cropMeta.label,
        message: cropMeta.label + ' plan for ' + area.acres.toFixed(2) + ' acres\n\n' + advice,
      });
    } catch {}
  };

  const openGpsWalk = () => {
    hapticBump();
    router.push('/farm-mapping' as any);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.kicker}>FIELD CALCULATOR</Text>
          <Text style={styles.title}>Land Size</Text>
          <Text style={styles.sub}>Measure your land and get seeds, fertilizer, and profit projections.</Text>

          <Pressable onPress={openGpsWalk} style={styles.gpsBtn}>
            <Text style={styles.gpsBtnText}>GPS WALK BOUNDARY (MORE ACCURATE)</Text>
          </Pressable>

          <View style={styles.tabRow}>
            <Pressable onPress={() => setMode('rect')} style={[styles.tab, mode === 'rect' && styles.tabOn]}>
              <Text style={[styles.tabText, mode === 'rect' && styles.tabTextOn]}>RECTANGLE</Text>
            </Pressable>
            <Pressable onPress={() => setMode('custom')} style={[styles.tab, mode === 'custom' && styles.tabOn]}>
              <Text style={[styles.tabText, mode === 'custom' && styles.tabTextOn]}>KNOWN AREA</Text>
            </Pressable>
          </View>

          {mode === 'rect' ? (
            <>
              <View style={styles.unitRow}>
                <Pressable onPress={() => setUnit('m')} style={[styles.unitBtn, unit === 'm' && styles.unitBtnOn]}>
                  <Text style={[styles.unitText, unit === 'm' && styles.unitTextOn]}>METRES</Text>
                </Pressable>
                <Pressable onPress={() => setUnit('ft')} style={[styles.unitBtn, unit === 'ft' && styles.unitBtnOn]}>
                  <Text style={[styles.unitText, unit === 'ft' && styles.unitTextOn]}>FEET</Text>
                </Pressable>
              </View>
              <Text style={styles.label}>LENGTH ({unit.toUpperCase()})</Text>
              <TextInput
                value={length} onChangeText={setLength}
                keyboardType="decimal-pad" placeholder="e.g. 100"
                placeholderTextColor={palette.textDim} style={styles.input}
              />
              <Text style={styles.label}>WIDTH ({unit.toUpperCase()})</Text>
              <TextInput
                value={width} onChangeText={setWidth}
                keyboardType="decimal-pad" placeholder="e.g. 50"
                placeholderTextColor={palette.textDim} style={styles.input}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>AREA (SQUARE METRES)</Text>
              <TextInput
                value={customArea} onChangeText={setCustomArea}
                keyboardType="decimal-pad" placeholder="e.g. 5000"
                placeholderTextColor={palette.textDim} style={styles.input}
              />
            </>
          )}

          {area ? (
            <LinearGradient colors={['#7c4dff', '#b388ff'] as any} style={styles.areaHero}>
              <Text style={styles.areaLabel}>YOUR LAND</Text>
              <CountUp value={area.acres} decimals={2} style={styles.areaBig} />
              <Text style={styles.areaUnit}>ACRES</Text>
              <View style={styles.areaBreak}>
                <View style={styles.areaCol}>
                  <Text style={styles.areaColVal}>{area.hectares.toFixed(2)}</Text>
                  <Text style={styles.areaColLbl}>HECTARES</Text>
                </View>
                <View style={styles.areaDiv} />
                <View style={styles.areaCol}>
                  <Text style={styles.areaColVal}>{area.plots.toFixed(1)}</Text>
                  <Text style={styles.areaColLbl}>PLOTS</Text>
                </View>
                <View style={styles.areaDiv} />
                <View style={styles.areaCol}>
                  <Text style={styles.areaColVal}>{area.pitches.toFixed(1)}</Text>
                  <Text style={styles.areaColLbl}>PITCHES</Text>
                </View>
              </View>
              <Text style={styles.areaNote}>
                About {area.plots.toFixed(1)} traditional plots or {area.pitches.toFixed(1)} football pitches.
              </Text>
            </LinearGradient>
          ) : null}

          <Text style={styles.sectionLabel}>CROP TO PLANT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CROPS.map((c) => (
              <Pressable
                key={c.key}
                onPress={() => setCrop(c.key)}
                style={[styles.chip, crop === c.key && styles.chipOn]}
              >
                <Text style={[styles.chipText, crop === c.key && styles.chipTextOn]}>
                  {c.emoji} {c.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {projectInputs ? (
            <>
              <Text style={styles.sectionLabel}>SEED & FERTILIZER</Text>
              <View style={styles.inputsCard}>
                <Row k="Seed" v={String(projectInputs.seed_kg) + ' kg'} styles={styles} />
                <Row k="NPK 15:15:15" v={String(projectInputs.npk_kg) + ' kg (' + projectInputs.npk_bags + ' bags)'} styles={styles} />
                <Row k="Urea" v={String(projectInputs.urea_kg) + ' kg (' + projectInputs.urea_bags + ' bags)'} styles={styles} />
                <Row k="Plants" v={projectInputs.plants.toLocaleString()} styles={styles} />
                <Row k="Input cost" v={'₦' + totalCost.toLocaleString()} styles={styles} highlight />
              </View>

              <Text style={styles.sectionLabel}>YIELD & PROFIT</Text>
              <View style={styles.inputsCard}>
                <Row k="Low yield" v={String(yields?.lo) + ' t → ₦' + (revenue?.lo || 0).toLocaleString()} styles={styles} />
                <Row k="Mid yield" v={String(yields?.mid) + ' t → ₦' + (revenue?.mid || 0).toLocaleString()} styles={styles} highlight />
                <Row k="High yield" v={String(yields?.hi) + ' t → ₦' + (revenue?.hi || 0).toLocaleString()} styles={styles} />
                <Row k="Profit (mid case)" v={'₦' + profitMid.toLocaleString()} styles={styles} highlight />
              </View>

              <Text style={styles.label}>YOUR PRICE PER TONNE (₦) - optional</Text>
              <TextInput
                value={price} onChangeText={setPrice}
                keyboardType="decimal-pad"
                placeholder={'Market est.: ₦' + cropMeta.price.toLocaleString()}
                placeholderTextColor={palette.textDim} style={styles.input}
              />

              <Text style={styles.sectionLabel}>GAIA PLAN IN</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {LANGUAGES.map((l) => (
                  <Pressable
                    key={l.key}
                    onPress={() => setLanguage(l.key as Lang)}
                    style={[styles.chip, language === l.key && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, language === l.key && styles.chipTextOn]}>{l.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Pressable onPress={askAdvice} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
                {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>GET FULL FARM PLAN</Text>}
              </Pressable>

              <Pressable onPress={saveAsFarm} disabled={saving} style={[styles.secondaryBtn, saving && { opacity: 0.5 }]}>
                {saving ? <ActivityIndicator color={palette.neon} /> : <Text style={styles.secondaryBtnText}>SAVE AS MY FARM</Text>}
              </Pressable>
            </>
          ) : null}

          {advice ? (
            <View style={styles.adviceCard}>
              <View style={styles.adviceHeadRow}>
                <Text style={styles.adviceHead}>GAIA'S PLAN</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable onPress={speakAdvice} style={styles.iconBtn}>
                    <Text style={styles.iconBtnText}>{speaking ? 'STOP' : 'SPEAK'}</Text>
                  </Pressable>
                  <Pressable onPress={sharePlan} style={styles.iconBtn}>
                    <Text style={styles.iconBtnText}>SHARE</Text>
                  </Pressable>
                </View>
              </View>
              <MarkdownOutput content={advice} />
            </View>
          ) : null}

          <View style={{ height: 100 }} />
        </ScrollView>
        <ConfettiBurst fire={confettiFire} origin="top" />
      </View>
    </KeyboardAvoidingView>
  );
}

function Row({ k, v, styles, highlight }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowK}>{k}</Text>
      <Text style={[styles.rowV, highlight && { color: '#00ff88', fontWeight: '900' }]}>{v}</Text>
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
  gpsBtn: {
    padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 16,
    borderWidth: 1.5, borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.08)',
  },
  gpsBtnText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, color: p.neon },
  tabRow: {
    flexDirection: 'row', gap: 6, marginBottom: 16,
    backgroundColor: p.surface, borderRadius: 12, padding: 4,
    borderWidth: 1, borderColor: p.border,
  },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  tabOn: { backgroundColor: 'rgba(0,255,136,0.12)' },
  tabText: { fontSize: 11, fontWeight: '700', color: p.textDim, letterSpacing: 1 },
  tabTextOn: { color: p.neon },
  unitRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  unitBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: p.border, alignItems: 'center' },
  unitBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  unitText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textDim },
  unitTextOn: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  areaHero: { borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  areaLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  areaBig: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 6 },
  areaUnit: { fontSize: 12, fontWeight: '900', letterSpacing: 3, color: 'rgba(255,255,255,0.85)' },
  areaBreak: { flexDirection: 'row', width: '100%', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)' },
  areaCol: { flex: 1, alignItems: 'center' },
  areaColVal: { fontSize: 15, fontWeight: '900', color: '#fff' },
  areaColLbl: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginTop: 3 },
  areaDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  areaNote: { fontSize: 10, color: 'rgba(255,255,255,0.75)', textAlign: 'center', marginTop: 12, lineHeight: 15 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 10 },
  chips: { gap: 6, paddingRight: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  inputsCard: { padding: 14, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginTop: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1.5 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  secondaryBtn: { padding: 16, borderRadius: 14, borderWidth: 1.5, borderColor: p.neon, alignItems: 'center', marginTop: 10 },
  secondaryBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1, color: p.neon },
  adviceCard: { padding: 16, borderRadius: 16, marginTop: 20, backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon },
  adviceHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  adviceHead: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  iconBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: p.border },
  iconBtnText: { fontSize: 10, fontWeight: '800', color: p.neon, letterSpacing: 1 },
});
