import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius, typography } from '../src/theme';

const API_BASE = 'https://gaia-api-xuly.onrender.com';
const ACRE_M2 = 4046.86;
const HECTARE_M2 = 10000;

// Seed + fertilizer rates per acre for Nigerian conditions
const CROPS = [
  { key: 'maize', label: 'Maize', seed_kg: 10, npk_kg: 80, urea_kg: 40, plants: 25000 },
  { key: 'rice',  label: 'Rice',  seed_kg: 40, npk_kg: 90, urea_kg: 45, plants: 100000 },
  { key: 'beans', label: 'Beans', seed_kg: 20, npk_kg: 30, urea_kg: 0,  plants: 60000 },
  { key: 'cassava', label: 'Cassava', seed_kg: 0, npk_kg: 60, urea_kg: 0, plants: 4000 },
  { key: 'tomato', label: 'Tomato', seed_kg: 1, npk_kg: 100, urea_kg: 30, plants: 6000 },
  { key: 'sorghum', label: 'Sorghum', seed_kg: 6, npk_kg: 60, urea_kg: 30, plants: 40000 },
  { key: 'millet', label: 'Millet', seed_kg: 5, npk_kg: 40, urea_kg: 20, plants: 50000 },
  { key: 'groundnut', label: 'Groundnut', seed_kg: 30, npk_kg: 20, urea_kg: 0, plants: 40000 },
];

const PRICE = { npk: 35000, urea: 32000 };  // Naira per 50kg bag

type Unit = 'm' | 'ft';

export default function LandEstimator() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [mode, setMode] = useState<'rect' | 'custom'>('rect');
  const [unit, setUnit] = useState<Unit>('m');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [customArea, setCustomArea] = useState('');
  const [crop, setCrop] = useState(CROPS[0].key);
  const [price, setPrice] = useState('');
  const [advice, setAdvice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const computeArea = () => {
    let sqm = 0;
    if (mode === 'rect') {
      const L = parseFloat(length);
      const W = parseFloat(width);
      if (!L || !W) return null;
      const Lm = unit === 'm' ? L : L * 0.3048;
      const Wm = unit === 'm' ? W : W * 0.3048;
      sqm = Lm * Wm;
    } else {
      const a = parseFloat(customArea);
      if (!a) return null;
      sqm = a;  // treat as m² by default
    }
    const acres = sqm / ACRE_M2;
    const hectares = sqm / HECTARE_M2;
    return { sqm, acres, hectares };
  };

  const area = computeArea();
  const cropMeta = CROPS.find((c) => c.key === crop)!;

  const projectInputs = area ? {
    seed_kg: +(cropMeta.seed_kg * area.acres).toFixed(1),
    npk_kg: +(cropMeta.npk_kg * area.acres).toFixed(1),
    urea_kg: +(cropMeta.urea_kg * area.acres).toFixed(1),
    plants: Math.round(cropMeta.plants * area.acres),
  } : null;

  const costEstimate = projectInputs ? {
    npk_bags: Math.ceil(projectInputs.npk_kg / 50),
    urea_bags: Math.ceil(projectInputs.urea_kg / 50),
  } : null;

  const totalCost = costEstimate
    ? costEstimate.npk_bags * PRICE.npk + costEstimate.urea_bags * PRICE.urea
    : 0;

  const expectedYield = area ? +(area.acres * 2.5).toFixed(1) : 0;  // rough tonnes/acre
  const priceNum = parseFloat(price) || 0;
  const grossRevenue = priceNum ? +(expectedYield * priceNum).toFixed(0) : 0;
  const profit = grossRevenue ? grossRevenue - totalCost : 0;

  const askAdvice = async () => {
    if (!area) return;
    setBusy(true);
    try {
      const { data: { session } } = await import('../src/api/supabase').then((m) => m.supabase.auth.getSession());
      const t = session?.access_token;
      if (!t) throw new Error('Not authenticated');

      const prompt = `A Nigerian farmer owns ${area.acres.toFixed(2)} acres (${area.hectares.toFixed(2)} hectares) of land.

They are planning to plant ${cropMeta.label}.

Their inputs will need:
- ${projectInputs?.seed_kg} kg seed
- ${projectInputs?.npk_kg} kg NPK 15:15:15
- ${projectInputs?.urea_kg} kg Urea
- About ${projectInputs?.plants} plants/stands

Estimated input cost: ₦${totalCost.toLocaleString()}

Give them a bold, specific plan:

## Farm Sizing Verdict
Is ${area.acres.toFixed(2)} acres a viable size for ${cropMeta.label}? Commercial or subsistence?

## Input Shopping List
Exact quantities + Naira cost per item + where to buy in Nigeria.

## Seed Rate & Spacing
Exact spacing (cm), number of seeds per hole, thinning plan.

## Fertilizer Schedule
When to apply NPK, when to top-dress urea, how to split. Exact kg per acre per application.

## Yield Expectation
Realistic tonnes per acre with good management. Cash value at current prices.

## Cost-Benefit
Table: Inputs | Yield | Revenue | Profit.

## The Unusual Trick
One non-obvious technique to boost yield on this specific size of land.

## Labour Plan
Land prep, planting, weeding, harvest — how many workers, how many days, Naira cost.

## Scaling Tip
If they want to double income, what to plant next on this land.

Rules: Naira costs, Nigerian context, speak to farmer, bold key terms, never mention AI.`;

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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>FIELD CALCULATOR</Text>
        <Text style={styles.title}>Land Size</Text>
        <Text style={styles.sub}>Measure your land → know your seeds, fertilizer, and expected profit.</Text>

        <View style={styles.tabRow}>
          <Pressable onPress={() => setMode('rect')} style={[styles.tab, mode === 'rect' && styles.tabOn]}>
            <Text style={[styles.tabText, mode === 'rect' && styles.tabTextOn]}>RECTANGLE</Text>
          </Pressable>
          <Pressable onPress={() => setMode('custom')} style={[styles.tab, mode === 'custom' && styles.tabOn]}>
            <Text style={[styles.tabText, mode === 'custom' && styles.tabTextOn]}>AREA</Text>
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
            <Text style={styles.areaBig}>{area.acres.toFixed(2)}</Text>
            <Text style={styles.areaUnit}>ACRES</Text>
            <View style={styles.areaBreak}>
              <View style={styles.areaCol}>
                <Text style={styles.areaColVal}>{area.hectares.toFixed(2)}</Text>
                <Text style={styles.areaColLbl}>HECTARES</Text>
              </View>
              <View style={styles.areaDiv} />
              <View style={styles.areaCol}>
                <Text style={styles.areaColVal}>{area.sqm.toLocaleString()}</Text>
                <Text style={styles.areaColLbl}>SQUARE METRES</Text>
              </View>
            </View>
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
              <Text style={[styles.chipText, crop === c.key && styles.chipTextOn]}>{c.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {projectInputs ? (
          <>
            <Text style={styles.sectionLabel}>SEED & FERTILIZER NEEDED</Text>
            <View style={styles.inputsCard}>
              <Row k="Seed" v={`${projectInputs.seed_kg} kg`} styles={styles} />
              <Row k="NPK 15:15:15" v={`${projectInputs.npk_kg} kg (~${costEstimate?.npk_bags} bags of 50kg)`} styles={styles} />
              <Row k="Urea" v={`${projectInputs.urea_kg} kg (~${costEstimate?.urea_bags} bags of 50kg)`} styles={styles} />
              <Row k="Plants / stands" v={projectInputs.plants.toLocaleString()} styles={styles} />
              <Row k="Input cost (est.)" v={`₦${totalCost.toLocaleString()}`} styles={styles} highlight />
            </View>

            <Text style={styles.sectionLabel}>YOUR SELLING PRICE</Text>
            <TextInput
              value={price} onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="Price per tonne (₦) — e.g. 250000 for maize"
              placeholderTextColor={palette.textDim} style={styles.input}
            />

            {priceNum > 0 ? (
              <View style={styles.inputsCard}>
                <Row k="Expected yield" v={`~${expectedYield} tonnes`} styles={styles} />
                <Row k="Gross revenue" v={`₦${grossRevenue.toLocaleString()}`} styles={styles} />
                <Row k="Total input cost" v={`-₦${totalCost.toLocaleString()}`} styles={styles} />
                <Row k="Expected profit" v={`₦${profit.toLocaleString()}`} styles={styles} highlight />
              </View>
            ) : null}

            <Pressable onPress={askAdvice} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
              {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaText}>GET FULL FARM PLAN</Text>}
            </Pressable>
          </>
        ) : null}

        {advice ? (
          <View style={styles.adviceCard}>
            <Text style={styles.adviceHead}>GAIA'S PLAN</Text>
            <Text style={styles.adviceBody}>{advice.slice(0, 3000)}</Text>
          </View>
        ) : null}

        <View style={{ height: 100 }} />
      </ScrollView>
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
  unitBtn: {
    flex: 1, padding: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: p.border, alignItems: 'center',
  },
  unitBtnOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  unitText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textDim },
  unitTextOn: { color: p.neon },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 12, marginBottom: 6 },
  input: {
    padding: 14, borderRadius: 12,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    color: p.text, fontSize: 15,
  },
  areaHero: { borderRadius: 24, padding: 24, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  areaLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: 'rgba(255,255,255,0.85)' },
  areaBig: { fontSize: 56, fontWeight: '900', color: '#fff', letterSpacing: -2, marginTop: 6 },
  areaUnit: { fontSize: 12, fontWeight: '900', letterSpacing: 3, color: 'rgba(255,255,255,0.85)' },
  areaBreak: {
    flexDirection: 'row', width: '100%', marginTop: 16,
    paddingTop: 14, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)',
  },
  areaCol: { flex: 1, alignItems: 'center' },
  areaColVal: { fontSize: 15, fontWeight: '900', color: '#fff' },
  areaColLbl: { fontSize: 9, fontWeight: '800', color: 'rgba(255,255,255,0.7)', letterSpacing: 1, marginTop: 3 },
  areaDiv: { width: 1, backgroundColor: 'rgba(255,255,255,0.25)' },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginTop: 20, marginBottom: 10 },
  chips: { gap: 6, paddingRight: 12 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    borderWidth: 1, borderColor: p.border, backgroundColor: p.surface,
  },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  chipTextOn: { color: p.neon },
  inputsCard: {
    padding: 14, borderRadius: 16,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.border,
    marginTop: 6,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowK: { fontSize: 12, color: p.textMuted, flex: 1 },
  rowV: { fontSize: 13, color: p.text, fontWeight: '700', textAlign: 'right', flex: 1.5 },
  cta: { padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center', marginTop: 16 },
  ctaText: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  adviceCard: {
    padding: 16, borderRadius: 16, marginTop: 20,
    backgroundColor: p.surface, borderWidth: 1, borderColor: p.neon,
  },
  adviceHead: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon, marginBottom: 8 },
  adviceBody: { fontSize: 12, color: p.text, lineHeight: 18 },
});
