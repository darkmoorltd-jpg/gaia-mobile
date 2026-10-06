import { useState } from 'react';
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, spacing, radius } from '../src/theme';
import {
  runAgroTool, NIGERIAN_CROPS, NIGERIAN_STATES,
  GROWTH_STAGES, PLANTING_MONTHS,
  type AgroTool,
} from '../src/utils/agro';

interface ToolDef {
  key: AgroTool;
  emoji: string;
  title: string;
  blurb: string;
  gradient: [string, string];
}

const TOOLS: ToolDef[] = [
  { key: 'yield',      emoji: '📈', title: 'Yield',      blurb: 'Expected harvest + revenue',  gradient: ['#00c853', '#00e676'] },
  { key: 'fertilizer', emoji: '🧪', title: 'Fertilizer', blurb: 'NPK plan with real products', gradient: ['#7c4dff', '#b388ff'] },
  { key: 'profit',     emoji: '💰', title: 'Profit',     blurb: 'Full P&L with margin %',      gradient: ['#f9a825', '#ffca28'] },
  { key: 'calendar',   emoji: '📅', title: 'Calendar',   blurb: 'Week-by-week season plan',    gradient: ['#039be5', '#4fc3f7'] },
  { key: 'seed',       emoji: '🌱', title: 'Seed',       blurb: 'Varieties that fit your zone', gradient: ['#e91e63', '#ff6090'] },
];

const fmt = (n: any) => {
  const x = Number(n || 0);
  return 'N' + x.toLocaleString('en-NG', { maximumFractionDigits: 0 });
};

export default function AgroTools() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [tool, setTool] = useState<AgroTool>('yield');
  const [crop, setCrop] = useState('Maize');
  const [state, setState] = useState('Kaduna');
  const [hectares, setHectares] = useState('1');
  const [budget, setBudget] = useState('');
  const [stage, setStage] = useState('');
  const [month, setMonth] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);

  const active = TOOLS.find((t) => t.key === tool)!;

  const run = async () => {
    const h = parseFloat(hectares);
    if (!crop.trim() || !state.trim()) {
      Alert.alert('Missing info', 'Pick a crop and a state.');
      return;
    }
    if (!h || h <= 0) {
      Alert.alert('Missing info', 'Enter a valid farm size in hectares.');
      return;
    }
    setBusy(true);
    setResult(null);
    const res = await runAgroTool({
      tool,
      crop: crop.trim(),
      state: state.trim(),
      hectares: h,
      budget_naira: parseFloat(budget) || 0,
      growth_stage: stage || undefined,
      planting_month: month || undefined,
      notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert('Failed', res.error || 'Try again');
      return;
    }
    setResult(res.data);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}>
          <Text style={styles.back}>BACK</Text>
        </Pressable>

        {/* HERO */}
        <LinearGradient
          colors={['#0a0e0c', '#101815', '#0a0e0c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroKicker}>GAIA FIELD LAB</Text>
          <Text style={styles.heroTitle}>Agro Tools</Text>
          <Text style={styles.heroSub}>Real Nigerian prices. Real seed varieties. Real margins.</Text>
        </LinearGradient>

        {/* TOOL PICKER */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {TOOLS.map((t) => {
            const on = t.key === tool;
            return (
              <Pressable
                key={t.key}
                onPress={() => { setTool(t.key); setResult(null); }}
                style={styles.chipPress}
              >
                <LinearGradient
                  colors={on ? t.gradient : [palette.surface, palette.surface]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  <Text style={[styles.chipEmoji, on && { fontSize: 20 }]}>{t.emoji}</Text>
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{t.title}</Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* FORM */}
        <View style={styles.card}>
          <Text style={[styles.cardTitle, { color: active.gradient[0] }]}>
            {active.emoji}  {active.title}
          </Text>
          <Text style={styles.cardBlurb}>{active.blurb}</Text>

          <Text style={styles.label}>CROP</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {NIGERIAN_CROPS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCrop(c)}
                style={[styles.pill, crop === c && styles.pillOn]}
              >
                <Text style={[styles.pillText, crop === c && styles.pillTextOn]}>{c}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>STATE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
            {NIGERIAN_STATES.map((s) => (
              <Pressable
                key={s}
                onPress={() => setState(s)}
                style={[styles.pill, state === s && styles.pillOn]}
              >
                <Text style={[styles.pillText, state === s && styles.pillTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>FARM SIZE (HECTARES)</Text>
          <TextInput
            value={hectares}
            onChangeText={setHectares}
            keyboardType="decimal-pad"
            placeholder="1.5"
            placeholderTextColor={palette.textDim}
            style={styles.input}
          />

          {tool === 'profit' ? (
            <>
              <Text style={styles.label}>BUDGET CAP (OPTIONAL)</Text>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                keyboardType="numeric"
                placeholder="e.g. 250000"
                placeholderTextColor={palette.textDim}
                style={styles.input}
              />
            </>
          ) : null}

          {tool === 'fertilizer' ? (
            <>
              <Text style={styles.label}>GROWTH STAGE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {GROWTH_STAGES.map((g) => (
                  <Pressable
                    key={g}
                    onPress={() => setStage(stage === g ? '' : g)}
                    style={[styles.pill, stage === g && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, stage === g && styles.pillTextOn]}>{g}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          {tool === 'calendar' || tool === 'seed' ? (
            <>
              <Text style={styles.label}>PLANTING MONTH (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
                {PLANTING_MONTHS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMonth(month === m ? '' : m)}
                    style={[styles.pill, month === m && styles.pillOn]}
                  >
                    <Text style={[styles.pillText, month === m && styles.pillTextOn]}>{m.slice(0, 3)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.label}>NOTES (OPTIONAL)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="e.g. rain-fed, no irrigation"
            placeholderTextColor={palette.textDim}
            style={[styles.input, { minHeight: 60 }]}
            multiline
          />

          <Pressable onPress={run} disabled={busy} style={styles.ctaWrap}>
            <LinearGradient
              colors={busy ? ['#222', '#333'] : active.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.cta}
            >
              {busy ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.ctaText}>RUN {active.title.toUpperCase()}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </View>

        {result ? <Result tool={tool} data={result} palette={palette} styles={styles} /> : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ============================================================
// RESULTS
// ============================================================

function Row({ label, value, accent, styles }: any) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowL}>{label}</Text>
      <Text style={[styles.rowV, accent && { color: accent }]}>{value}</Text>
    </View>
  );
}

function Notes({ items, styles, color }: any) {
  if (!items || items.length === 0) return null;
  return (
    <View style={styles.notesBox}>
      {items.map((n: string, i: number) => (
        <Text key={i} style={[styles.noteText, color && { color }]}>•  {n}</Text>
      ))}
    </View>
  );
}

function Result({ tool, data, palette, styles }: any) {
  if (!data) return null;

  if (tool === 'yield') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>Yield Forecast</Text>
        <View style={styles.bigBox}>
          <Text style={styles.bigVal}>{fmt(data.gross_revenue_naira)}</Text>
          <Text style={styles.bigLbl}>GROSS REVENUE</Text>
        </View>
        <Row styles={styles} label="Expected yield" value={Number(data.expected_yield_kg || 0).toLocaleString() + ' kg'} />
        <Row styles={styles} label="Per hectare" value={Number(data.yield_per_hectare_kg || 0).toLocaleString() + ' kg'} />
        <Row styles={styles} label="Price per kg" value={fmt(data.price_per_kg_naira)} />
        <Row styles={styles} label="Low estimate" value={Number(data.yield_range_low_kg || 0).toLocaleString() + ' kg'} />
        <Row styles={styles} label="High estimate" value={Number(data.yield_range_high_kg || 0).toLocaleString() + ' kg'} />
        <Row styles={styles} label="Confidence" value={(data.confidence || '').toUpperCase()} accent={palette.neon} />
        {data.limiting_factors && data.limiting_factors.length ? (
          <>
            <Text style={styles.subHead}>Risk factors</Text>
            <Notes styles={styles} items={data.limiting_factors} color={palette.warning} />
          </>
        ) : null}
        {data.boosters && data.boosters.length ? (
          <>
            <Text style={styles.subHead}>Boosters</Text>
            <Notes styles={styles} items={data.boosters} color={palette.neon} />
          </>
        ) : null}
        <Notes styles={styles} items={data.notes} />
      </View>
    );
  }

  if (tool === 'fertilizer') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>Fertilizer Plan</Text>
        <View style={styles.bigBox}>
          <Text style={styles.bigVal}>{fmt(data.total_cost_naira)}</Text>
          <Text style={styles.bigLbl}>TOTAL COST</Text>
        </View>
        {(data.stages || []).map((s: any, i: number) => (
          <View key={i} style={styles.stageCard}>
            <View style={styles.stageHead}>
              <Text style={styles.stageTitle}>{s.stage}</Text>
              <Text style={styles.stageWeek}>Week {s.weeks_after_planting}</Text>
            </View>
            <Text style={styles.stageProduct}>{s.product}  ·  {s.npk_ratio}</Text>
            <Row styles={styles} label="Quantity" value={Number(s.quantity_kg || 0).toLocaleString() + ' kg  (' + (s.bags_50kg || 0) + ' bags)'} />
            <Row styles={styles} label="Cost" value={fmt(s.cost_naira)} accent={palette.warning} />
            <Text style={styles.stageMethod}>{s.application_method}</Text>
          </View>
        ))}
        {data.total_nutrients ? (
          <View style={styles.nutriRow}>
            <View style={styles.nutriBox}><Text style={styles.nutriV}>{data.total_nutrients.N_kg || 0}</Text><Text style={styles.nutriL}>N kg</Text></View>
            <View style={styles.nutriBox}><Text style={styles.nutriV}>{data.total_nutrients.P_kg || 0}</Text><Text style={styles.nutriL}>P kg</Text></View>
            <View style={styles.nutriBox}><Text style={styles.nutriV}>{data.total_nutrients.K_kg || 0}</Text><Text style={styles.nutriL}>K kg</Text></View>
          </View>
        ) : null}
        {data.organic_alternatives && data.organic_alternatives.length ? (
          <>
            <Text style={styles.subHead}>Organic alternatives</Text>
            <Notes styles={styles} items={data.organic_alternatives} color={palette.neon} />
          </>
        ) : null}
        <Notes styles={styles} items={data.notes} />
      </View>
    );
  }

  if (tool === 'profit') {
    const margin = Number(data.margin_percent || 0);
    const marginColor = margin > 30 ? palette.neon : margin > 15 ? palette.warning : palette.danger;
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>Profit Analysis</Text>
        <View style={styles.bigBox}>
          <Text style={[styles.bigVal, { color: marginColor }]}>
            {fmt(data.gross_margin_naira)}
          </Text>
          <Text style={styles.bigLbl}>GROSS MARGIN</Text>
        </View>

        <View style={styles.marginBar}>
          <View style={[styles.marginFill, { width: Math.max(0, Math.min(100, margin)) + '%', backgroundColor: marginColor }]} />
        </View>
        <Text style={styles.marginLabel}>{margin.toFixed(1)}% margin  ·  {Number(data.roi_percent || 0).toFixed(1)}% ROI</Text>

        <Row styles={styles} label="Revenue" value={fmt(data.revenue_naira)} accent={palette.neon} />
        <Row styles={styles} label="Total costs" value={fmt(data.total_cost_naira)} accent={palette.danger} />
        <Row styles={styles} label="Break-even yield" value={Number(data.break_even_kg || 0).toLocaleString() + ' kg'} />
        <Row styles={styles} label="Break-even price" value={fmt(data.break_even_price_naira) + ' / kg'} />

        <Text style={styles.subHead}>Cost breakdown</Text>
        {(data.costs || []).map((c: any, i: number) => (
          <Row key={i} styles={styles} label={c.item + '  ·  ' + c.category} value={fmt(c.amount_naira)} />
        ))}

        {data.risk_factors && data.risk_factors.length ? (
          <>
            <Text style={styles.subHead}>Risks</Text>
            <Notes styles={styles} items={data.risk_factors} color={palette.warning} />
          </>
        ) : null}
        <Notes styles={styles} items={data.notes} />
      </View>
    );
  }

  if (tool === 'calendar') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>Season Calendar</Text>
        <View style={styles.bigBox}>
          <Text style={styles.bigVal}>{data.duration_days || '—'} days</Text>
          <Text style={styles.bigLbl}>SEASON LENGTH</Text>
        </View>
        <Row styles={styles} label="Planting window" value={data.planting_window || '—'} />
        <Row styles={styles} label="Harvest window" value={data.harvest_window || '—'} />
        <Text style={styles.subHead}>Timeline</Text>
        {(data.activities || []).map((a: any, i: number) => (
          <View key={i} style={styles.timelineRow}>
            <View style={styles.weekBadge}>
              <Text style={styles.weekText}>W{a.week}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tlTask}>{a.task}</Text>
              <Text style={styles.tlMeta}>{a.phase}  ·  {a.category}</Text>
            </View>
          </View>
        ))}
        <Notes styles={styles} items={data.climate_notes} color={palette.warning} />
        <Notes styles={styles} items={data.notes} />
      </View>
    );
  }

  if (tool === 'seed') {
    return (
      <View style={styles.result}>
        <Text style={styles.resultTitle}>Seed Varieties</Text>
        <View style={styles.bigBox}>
          <Text style={styles.bigVal}>{data.top_pick || '—'}</Text>
          <Text style={styles.bigLbl}>TOP PICK</Text>
        </View>
        {(data.varieties || []).map((v: any, i: number) => (
          <View key={i} style={[styles.stageCard, v.name === data.top_pick && { borderColor: palette.neon }]}>
            <View style={styles.stageHead}>
              <Text style={styles.stageTitle}>{v.name}</Text>
              <Text style={styles.stageWeek}>{v.maturity_days} d</Text>
            </View>
            <Row styles={styles} label="Yield potential" value={Number(v.yield_potential_kg_per_ha || 0).toLocaleString() + ' kg/ha'} accent={palette.neon} />
            <Row styles={styles} label="Seed rate" value={(v.seed_rate_kg_per_ha || 0) + ' kg/ha'} />
            <Row styles={styles} label="Price" value={fmt(v.price_per_kg_naira) + ' / kg'} />
            <Row styles={styles} label="Drought tolerance" value={(v.drought_tolerance || '').toUpperCase()} />
            <Row styles={styles} label="Zone" value={v.recommended_zone || '—'} />
            {v.disease_resistance && v.disease_resistance.length ? (
              <Text style={styles.stageMethod}>Resistant: {v.disease_resistance.join(', ')}</Text>
            ) : null}
            {v.where_to_buy && v.where_to_buy.length ? (
              <Text style={styles.stageMethod}>Buy: {v.where_to_buy.join(' · ')}</Text>
            ) : null}
          </View>
        ))}
        <Notes styles={styles} items={data.notes} />
      </View>
    );
  }

  return null;
}

// ============================================================
// STYLES
// ============================================================

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 56, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },

  hero: {
    padding: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: p.border,
    marginBottom: 16,
    overflow: 'hidden',
  },
  heroKicker: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: '#00ff88', marginBottom: 4 },
  heroTitle: { fontSize: 36, fontWeight: '900', color: '#fff', letterSpacing: -1.2 },
  heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 18 },

  chips: { gap: 8, paddingVertical: 4, paddingRight: 16 },
  chipPress: { borderRadius: 16, overflow: 'hidden' },
  chip: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, alignItems: 'center', minWidth: 92 },
  chipOn: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  chipEmoji: { fontSize: 16, marginBottom: 4 },
  chipText: { fontSize: 11, fontWeight: '800', color: p.textMuted, letterSpacing: 0.5 },
  chipTextOn: { color: '#000' },

  card: {
    marginTop: 16,
    padding: 20,
    borderRadius: 20,
    backgroundColor: p.surface,
    borderWidth: 1,
    borderColor: p.border,
  },
  cardTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  cardBlurb: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 8 },

  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 6 },
  pillRow: { gap: 6, paddingVertical: 2, paddingRight: 12 },
  pill: {
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1, borderColor: p.border,
    backgroundColor: p.obsidian,
  },
  pillOn: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.12)' },
  pillText: { fontSize: 11, fontWeight: '700', color: p.textDim },
  pillTextOn: { color: '#00ff88' },

  input: {
    backgroundColor: p.obsidian,
    borderWidth: 1, borderColor: p.border,
    borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    color: p.text, fontSize: 15,
  },

  ctaWrap: { marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  cta: { padding: 18, alignItems: 'center' },
  ctaText: { fontSize: 14, fontWeight: '900', color: '#000', letterSpacing: 1 },

  result: {
    marginTop: 20,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: p.border,
  },
  resultTitle: { fontSize: 18, fontWeight: '900', color: p.text, marginBottom: 12, letterSpacing: -0.3 },

  bigBox: {
    padding: 20, borderRadius: 16,
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)',
    alignItems: 'center', marginBottom: 16,
  },
  bigVal: { fontSize: 30, fontWeight: '900', color: '#00ff88', letterSpacing: -1 },
  bigLbl: { fontSize: 10, fontWeight: '800', letterSpacing: 2, color: p.textMuted, marginTop: 4 },

  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  rowL: { fontSize: 12, color: p.textMuted, flex: 1, marginRight: 12 },
  rowV: { fontSize: 13, fontWeight: '800', color: p.text },

  subHead: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 20, marginBottom: 8 },

  notesBox: { marginTop: 10, gap: 6 },
  noteText: { fontSize: 12, color: p.textMuted, lineHeight: 18 },

  stageCard: {
    padding: 14, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1, borderColor: p.border,
    marginBottom: 10,
  },
  stageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  stageTitle: { fontSize: 14, fontWeight: '900', color: p.text },
  stageWeek: { fontSize: 11, fontWeight: '800', color: '#00ff88' },
  stageProduct: { fontSize: 12, color: p.textMuted, marginBottom: 8 },
  stageMethod: { fontSize: 11, color: p.textDim, marginTop: 8, fontStyle: 'italic' },

  nutriRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  nutriBox: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.06)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.2)', alignItems: 'center' },
  nutriV: { fontSize: 18, fontWeight: '900', color: '#00ff88' },
  nutriL: { fontSize: 9, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 2 },

  marginBar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 6 },
  marginFill: { height: '100%', borderRadius: 5 },
  marginLabel: { fontSize: 11, fontWeight: '700', color: p.textMuted, marginTop: 8, textAlign: 'center' },

  timelineRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 10 },
  weekBadge: { width: 42, height: 42, borderRadius: 12, backgroundColor: 'rgba(0,255,136,0.1)', borderWidth: 1, borderColor: 'rgba(0,255,136,0.3)', alignItems: 'center', justifyContent: 'center' },
  weekText: { fontSize: 12, fontWeight: '900', color: '#00ff88' },
  tlTask: { fontSize: 13, fontWeight: '700', color: p.text },
  tlMeta: { fontSize: 10, color: p.textMuted, marginTop: 2, letterSpacing: 0.5, textTransform: 'uppercase' },
});
