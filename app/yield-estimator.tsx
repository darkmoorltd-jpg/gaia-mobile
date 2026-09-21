import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';

const CROPS = {
  maize:    { yieldPerHa: 2500, unit: 'kg/ha', price: 500,  days: 90  },
  rice:     { yieldPerHa: 3500, unit: 'kg/ha', price: 700,  days: 120 },
  cassava:  { yieldPerHa: 12000, unit: 'kg/ha', price: 200, days: 270 },
  tomato:   { yieldPerHa: 25000, unit: 'kg/ha', price: 350, days: 75  },
  pepper:   { yieldPerHa: 8000, unit: 'kg/ha', price: 600,  days: 90  },
  yam:      { yieldPerHa: 10000, unit: 'kg/ha', price: 450, days: 240 },
  soybean:  { yieldPerHa: 1500, unit: 'kg/ha', price: 800,  days: 100 },
  groundnut:{ yieldPerHa: 1200, unit: 'kg/ha', price: 900,  days: 110 },
};

export default function YieldEstimator() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [crop, setCrop] = useState('maize');
  const [acres, setAcres] = useState('1');
  const [health, setHealth] = useState<'good' | 'fair' | 'poor'>('good');
  const [result, setResult] = useState<any>(null);

  const calculate = () => {
    const a = parseFloat(acres) || 0;
    const h = a * 0.4047;
    const base = CROPS[crop as keyof typeof CROPS].yieldPerHa * h;
    const factor = health === 'good' ? 1 : health === 'fair' ? 0.7 : 0.4;
    const yieldKg = base * factor;
    const revenue = yieldKg * CROPS[crop as keyof typeof CROPS].price;
    setResult({ yieldKg, revenue, crop: CROPS[crop as keyof typeof CROPS] });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Yield Estimator</Text>

        <Text style={styles.label}>CROP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.keys(CROPS).map((c) => (
              <Text key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipActive]}>
                {c.toUpperCase()}
              </Text>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput value={acres} onChangeText={setAcres} keyboardType="decimal-pad" style={styles.input} />

        <Text style={styles.label}>CROP HEALTH</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['good', 'fair', 'poor'] as const).map((h) => (
            <Text key={h} onPress={() => setHealth(h)} style={[styles.chip, health === h && styles.chipActive]}>
              {h.toUpperCase()}
            </Text>
          ))}
        </View>

        <NeonButton label="CALCULATE" onPress={calculate} style={{ marginTop: 24 }} />

        {result ? (
          <GlassCard style={{ marginTop: 20 }}>
            <Text style={styles.resultLbl}>EXPECTED YIELD</Text>
            <Text style={styles.resultVal}>{result.yieldKg.toFixed(0)} kg</Text>
            <Text style={styles.resultLbl}>ESTIMATED REVENUE</Text>
            <Text style={styles.resultVal}>₦{(result.revenue / 1000).toFixed(0)}K</Text>
            <Text style={styles.hint}>Growing period: {result.crop.days} days</Text>
          </GlassCard>
        ) : null}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8, marginBottom: 16 },
  label: { ...typography.micro, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontWeight: '700', fontSize: 12 },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon, color: p.obsidian },
  input: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16 },
  resultLbl: { ...typography.micro, color: p.textMuted },
  resultVal: { fontSize: 30, fontWeight: '900', color: p.neon, marginTop: 4, marginBottom: 14 },
  hint: { ...typography.caption, color: p.textMuted, marginTop: 8 },
});
