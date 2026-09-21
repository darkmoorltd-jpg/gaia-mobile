import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';

const NPK = { maize: 250, rice: 300, cassava: 200, tomato: 400, pepper: 300, yam: 200 };

export default function InputCalculator() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [crop, setCrop] = useState('maize');
  const [acres, setAcres] = useState('1');
  const [result, setResult] = useState<any>(null);

  const calc = () => {
    const a = parseFloat(acres) || 0;
    const rate = NPK[crop as keyof typeof NPK];
    const urea = a * rate * 0.4;
    const dap = a * rate * 0.3;
    const mop = a * rate * 0.3;
    setResult({
      urea: urea.toFixed(1),
      dap: dap.toFixed(1),
      mop: mop.toFixed(1),
      total: (urea + dap + mop).toFixed(1),
    });
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Fertilizer Calculator</Text>
        <Text style={styles.subtitle}>How much NPK do you need?</Text>

        <Text style={styles.label}>CROP</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {Object.keys(NPK).map((c) => (
              <Text key={c} onPress={() => setCrop(c)} style={[styles.chip, crop === c && styles.chipActive]}>
                {c.toUpperCase()}
              </Text>
            ))}
          </View>
        </ScrollView>

        <Text style={styles.label}>FARM SIZE (ACRES)</Text>
        <TextInput value={acres} onChangeText={setAcres} keyboardType="decimal-pad" style={styles.input} />

        <NeonButton label="CALCULATE" onPress={calc} style={{ marginTop: 24 }} />

        {result ? (
          <GlassCard style={{ marginTop: 20 }}>
            <Text style={styles.resultLbl}>UREA (46-0-0)</Text>
            <Text style={styles.resultVal}>{result.urea} kg</Text>
            <Text style={styles.resultLbl}>DAP (18-46-0)</Text>
            <Text style={styles.resultVal}>{result.dap} kg</Text>
            <Text style={styles.resultLbl}>MOP (0-0-60)</Text>
            <Text style={styles.resultVal}>{result.mop} kg</Text>
            <View style={styles.divider} />
            <Text style={styles.resultLbl}>TOTAL</Text>
            <Text style={[styles.resultVal, { color: palette.warning }]}>{result.total} kg</Text>
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
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  subtitle: { ...typography.body, color: p.textMuted, marginTop: 6 },
  label: { ...typography.micro, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontWeight: '700', fontSize: 12 },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon, color: p.obsidian },
  input: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 16 },
  resultLbl: { ...typography.micro, color: p.textMuted, marginTop: 8 },
  resultVal: { fontSize: 22, fontWeight: '900', color: p.neon, marginTop: 2 },
  divider: { height: 1, backgroundColor: p.border, marginVertical: 14 },
});
