import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, spacing, typography } from '../src/theme';
import { Pill, GlassCard, NeonButton } from '../src/components';

const SOILS = ['sandy', 'loamy', 'clay', 'laterite', 'black'];
const CLIMATES = ['rainforest', 'savanna', 'sahel', 'highland'];

const SEEDS: any = {
  maize: {
    sandy:    { rainforest: ['TZEE-Y', 'SAMMAZ 14'], savanna: ['SAMMAZ 37', 'SC651'], sahel: ['SAMMAZ 40'], highland: ['SC Duma 43'] },
    loamy:    { rainforest: ['SAMMAZ 15', 'Oba Super 2'], savanna: ['SAMMAZ 52', 'TZEE-Y'], sahel: ['SAMMAZ 40'], highland: ['SC Duma 43'] },
    clay:     { rainforest: ['SAMMAZ 14'], savanna: ['SC651', 'SAMMAZ 37'], sahel: ['SAMMAZ 40'], highland: ['SC Duma 43'] },
    laterite: { rainforest: ['Oba Super 2'], savanna: ['SAMMAZ 37'], sahel: ['SAMMAZ 40'], highland: ['SC Duma 43'] },
    black:    { rainforest: ['SAMMAZ 15'], savanna: ['SAMMAZ 52'], sahel: ['SAMMAZ 40'], highland: ['SC Duma 43'] },
  },
  rice: {
    sandy:    { rainforest: ['FARO 44'], savanna: ['FARO 60', 'WITA 4'], sahel: ['FARO 61'], highland: ['NERICA 4'] },
    loamy:    { rainforest: ['FARO 44', 'NERICA 1'], savanna: ['FARO 60'], sahel: ['FARO 61'], highland: ['NERICA 4'] },
    clay:     { rainforest: ['FARO 44'], savanna: ['FARO 60', 'WITA 4'], sahel: ['FARO 61'], highland: ['NERICA 4'] },
    laterite: { rainforest: ['NERICA 1'], savanna: ['FARO 60'], sahel: ['FARO 61'], highland: ['NERICA 4'] },
    black:    { rainforest: ['FARO 44'], savanna: ['FARO 60'], sahel: ['FARO 61'], highland: ['NERICA 4'] },
  },
};

export default function SeedRecommender() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [crop, setCrop] = useState('maize');
  const [soil, setSoil] = useState('loamy');
  const [climate, setClimate] = useState('savanna');
  const [result, setResult] = useState<string[]>([]);

  const recommend = () => {
    const cropData = SEEDS[crop];
    if (!cropData) return setResult(['No data for this crop yet']);
    const varieties = cropData[soil]?.[climate] || ['Consult local extension officer'];
    setResult(varieties);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Seed Recommender</Text>

        <Text style={styles.label}>CROP</Text>
        <View style={styles.chipRow}>
          {Object.keys(SEEDS).map((c) => (
            <Text key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipActive]}>{c}</Text>
          ))}
        </View>

        <Text style={styles.label}>SOIL TYPE</Text>
        <View style={styles.chipRow}>
          {SOILS.map((s) => (
            <Text key={s} onPress={() => setSoil(s)} style={[styles.chip, soil === s && styles.chipActive]}>{s}</Text>
          ))}
        </View>

        <Text style={styles.label}>CLIMATE ZONE</Text>
        <View style={styles.chipRow}>
          {CLIMATES.map((c) => (
            <Text key={c} onPress={() => setClimate(c)} style={[styles.chip, climate === c && styles.chipActive]}>{c}</Text>
          ))}
        </View>

        <NeonButton label="RECOMMEND" onPress={recommend} style={{ marginTop: 20 }} />

        {result.length > 0 ? (
          <GlassCard style={{ marginTop: 20 }}>
            <Text style={styles.resultLbl}>BEST VARIETIES FOR YOU</Text>
            {result.map((v, i) => (
              <Text key={i} style={styles.resultItem}>• {v}</Text>
            ))}
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
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8, marginBottom: 16 },
  label: { ...typography.micro, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontWeight: '700', fontSize: 12 },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon, color: p.obsidian },
  resultLbl: { ...typography.micro, color: p.textMuted },
  resultItem: { fontSize: 16, color: p.neon, fontWeight: '700', marginTop: 8 },
});
