import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme, spacing, typography } from '../src/theme';
import { Pill, GlassCard } from '../src/components';

const CALENDAR = {
  maize:    { north: 'Apr–Jun', south: 'Mar–May & Aug–Sep', harvest: '90 days' },
  rice:     { north: 'May–Jul', south: 'Apr–Jun', harvest: '120 days' },
  cassava:  { north: 'Apr–Jul', south: 'Apr–Jun', harvest: '9–12 months' },
  yam:      { north: 'Feb–Apr', south: 'Feb–Apr', harvest: '8 months' },
  tomato:   { north: 'Oct–Feb (dry)', south: 'Oct–Mar', harvest: '75 days' },
  pepper:   { north: 'Apr–Jun', south: 'Mar–Jun', harvest: '90 days' },
  soybean:  { north: 'Jun–Jul', south: 'May–Jun', harvest: '100 days' },
  groundnut:{ north: 'May–Jun', south: 'Apr–May', harvest: '110 days' },
  sorghum:  { north: 'Jun–Jul', south: 'May–Jun', harvest: '110 days' },
  millet:   { north: 'Jun–Jul', south: 'May–Jun', harvest: '90 days' },
};

export default function PlantingCalendar() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [region, setRegion] = useState<'north' | 'south'>('north');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Farm Tools" />
        <Text style={styles.title}>Planting Calendar</Text>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 20 }}>
          {(['north', 'south'] as const).map((r) => (
            <Text key={r} onPress={() => setRegion(r)} style={[styles.chip, region === r && styles.chipActive]}>
              {r.toUpperCase()} NIGERIA
            </Text>
          ))}
        </View>

        {Object.entries(CALENDAR).map(([crop, data]: any) => (
          <GlassCard key={crop} style={{ marginBottom: 10 }}>
            <Text style={styles.crop}>{crop.toUpperCase()}</Text>
            <Text style={styles.row}><Text style={styles.label}>Plant: </Text>{data[region]}</Text>
            <Text style={styles.row}><Text style={styles.label}>Harvest: </Text>{data.harvest}</Text>
          </GlassCard>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60 },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 8 },
  chip: { flex: 1, textAlign: 'center', paddingVertical: 12, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontWeight: '700' },
  chipActive: { backgroundColor: p.neon, borderColor: p.neon, color: p.obsidian },
  crop: { fontSize: 16, fontWeight: '900', color: p.neon, letterSpacing: 1 },
  row: { ...typography.body, color: p.text, marginTop: 8 },
  label: { color: p.textMuted, fontWeight: '600' },
});
