import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useTheme, spacing, typography } from '../src/theme';
import { NeonButton, GlassCard, Pill } from '../src/components';

export default function ProfitCalculator() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [revenue, setRevenue] = useState('');
  const [seedCost, setSeedCost] = useState('');
  const [fertCost, setFertCost] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [otherCost, setOtherCost] = useState('');
  const [result, setResult] = useState<any>(null);

  const calc = () => {
    const rev = parseFloat(revenue) || 0;
    const total = (parseFloat(seedCost) || 0) + (parseFloat(fertCost) || 0) + (parseFloat(laborCost) || 0) + (parseFloat(otherCost) || 0);
    const profit = rev - total;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;
    setResult({ revenue: rev, total, profit, margin });
  };

  const Row = ({ label, value, setValue }: any) => (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={setValue} keyboardType="decimal-pad" style={styles.input} placeholder="0" placeholderTextColor={palette.textDim} />
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Profit Calculator</Text>

        <Text style={styles.section}>REVENUE</Text>
        <Row label="TOTAL REVENUE (₦)" value={revenue} setValue={setRevenue} />

        <Text style={styles.section}>COSTS</Text>
        <Row label="SEEDS (₦)" value={seedCost} setValue={setSeedCost} />
        <Row label="FERTILIZER (₦)" value={fertCost} setValue={setFertCost} />
        <Row label="LABOR (₦)" value={laborCost} setValue={setLaborCost} />
        <Row label="OTHER (₦)" value={otherCost} setValue={setOtherCost} />

        <NeonButton label="CALCULATE PROFIT" onPress={calc} style={{ marginTop: 12 }} />

        {result ? (
          <GlassCard style={{ marginTop: 20 }}>
            <Text style={styles.resultLbl}>PROFIT</Text>
            <Text style={[styles.resultVal, { color: result.profit >= 0 ? palette.neon : palette.danger }]}>
              ₦{result.profit.toLocaleString()}
            </Text>
            <Text style={styles.resultLbl}>MARGIN</Text>
            <Text style={styles.resultVal}>{result.margin.toFixed(1)}%</Text>
            <Text style={styles.resultLbl}>TOTAL COST</Text>
            <Text style={[styles.resultVal, { color: palette.warning }]}>₦{result.total.toLocaleString()}</Text>
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
  section: { ...typography.micro, color: p.neon, marginTop: 16, marginBottom: 8 },
  label: { ...typography.micro, color: p.textMuted, marginBottom: 4 },
  input: { padding: 14, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  resultLbl: { ...typography.micro, color: p.textMuted, marginTop: 8 },
  resultVal: { fontSize: 26, fontWeight: '900', color: p.neon, marginTop: 4 },
});
