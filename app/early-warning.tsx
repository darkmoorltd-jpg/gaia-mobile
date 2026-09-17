
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, Pill } from '../src/components';
import { palette, typography, spacing } from '../src/theme';

const ALERTS = [
  { emoji: '⚠', title: 'Northern Leaf Blight', level: 'HIGH', pct: 85, color: palette.danger,  desc: 'Next 7 days · maize farms' },
  { emoji: '🐛', title: 'Fall Armyworm',       level: 'MODERATE', pct: 62, color: palette.warning, desc: 'Rain-dependent spread' },
  { emoji: '🌧', title: 'Flood potential',     level: 'LOW', pct: 12, color: palette.neon, desc: 'Below seasonal average' },
];

export default function EarlyWarning() {
  return (
    <Screen glow="pests">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Kaduna Region" color={palette.warning} />
        <Text style={styles.title}>Early Warning</Text>
        <Text style={styles.subtitle}>Real-time alerts for your area.</Text>

        <View style={styles.riskCard}>
          <Text style={styles.riskLabel}>RISK LEVEL</Text>
          <Text style={styles.riskValue}>MODERATE</Text>
        </View>

        {ALERTS.map((a, i) => (
          <View key={i} style={{ marginBottom: spacing.md }}>
            <GlassCard>
              <View style={styles.alertHeader}>
                <Text style={styles.alertEmoji}>{a.emoji}</Text>
                <Text style={styles.alertTitle}>{a.title}</Text>
                <View style={[styles.levelPill, { borderColor: a.color + '88' }]}>
                  <Text style={[styles.levelText, { color: a.color }]}>{a.level}</Text>
                </View>
              </View>
              <Text style={styles.alertDesc}>{a.desc}</Text>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${a.pct}%`, backgroundColor: a.color }]} />
              </View>
              <Text style={styles.pctText}>{a.pct}% probability</Text>
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
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  riskCard: {
    padding: spacing.xl, borderRadius: 20, marginBottom: spacing.xl,
    backgroundColor: palette.warning + '15', borderWidth: 1, borderColor: palette.warning + '55',
  },
  riskLabel: { ...typography.micro, color: palette.textMuted },
  riskValue: { fontSize: 32, fontWeight: '900', color: palette.warning, letterSpacing: 1, marginTop: 4 },
  alertHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  alertEmoji: { fontSize: 24 },
  alertTitle: { ...typography.body, color: palette.text, fontWeight: '700', flex: 1 },
  levelPill: { borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  levelText: { ...typography.micro },
  alertDesc: { ...typography.caption, color: palette.textMuted, marginBottom: spacing.md },
  barBg: { height: 6, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  pctText: { ...typography.micro, color: palette.textDim, marginTop: 6 },
});
