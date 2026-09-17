
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, Pill } from '../src/components';
import { palette, typography, spacing, radius } from '../src/theme';

const DAYS = ['M','T','W','T','F','S','S'];
const TODAY = 17;

const TASKS = [
  { icon: '🌱', title: 'Plant Maize',    sub: '6 AM – 9 AM · Optimal window', color: palette.crops },
  { icon: '💧', title: 'Water crops',    sub: 'Rainfall predicted: 12mm',     color: '#66d9ff' },
  { icon: '🧪', title: 'Apply fertilizer', sub: 'NPK 15-15-15, 2kg/acre',     color: palette.pests },
  { icon: '🔍', title: 'Scout for pests',  sub: 'Check leaves underside',     color: palette.livestock },
];

export default function Calendar() {
  const days = Array.from({ length: 30 }, (_, i) => i + 1);
  const startOffset = 0;

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="September 2026" />
        <Text style={styles.title}>Calendar</Text>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <View style={styles.dow}>
            {DAYS.map((d, i) => (
              <Text key={i} style={styles.dowText}>{d}</Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {Array.from({ length: startOffset }).map((_, i) => (
              <View key={'e' + i} style={styles.dayCell} />
            ))}
            {days.map((d) => (
              <View key={d} style={[styles.dayCell, d === TODAY && styles.dayCellToday]}>
                <Text style={[styles.dayText, d === TODAY && styles.dayTextToday]}>{d}</Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={styles.sectionLabel}>TODAY · {TODAY} SEPT</Text>

        {TASKS.map((t, i) => (
          <View key={i} style={{ marginBottom: spacing.sm }}>
            <GlassCard>
              <View style={styles.taskRow}>
                <View style={[styles.taskIconWrap, { backgroundColor: t.color + '22' }]}>
                  <Text style={styles.taskIcon}>{t.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.taskTitle}>{t.title}</Text>
                  <Text style={styles.taskSub}>{t.sub}</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm },
  dow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  dowText: { ...typography.micro, color: palette.textDim, width: 40, textAlign: 'center' },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  dayCellToday: { backgroundColor: palette.neonSoft, borderRadius: 20, borderWidth: 1, borderColor: palette.borderHi },
  dayText: { color: palette.textMuted, fontSize: 13, fontWeight: '600' },
  dayTextToday: { color: palette.neon, fontWeight: '900' },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xl, marginBottom: spacing.md },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  taskIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  taskIcon: { fontSize: 22 },
  taskTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  taskSub: { ...typography.caption, color: palette.textMuted, marginTop: 4 },
});
