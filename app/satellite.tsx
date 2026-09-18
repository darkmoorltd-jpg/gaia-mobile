
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, Pill, StatCard } from '../src/components';
import { typography, spacing, radius } from '../src/theme';
import { useTheme } from '../src/theme';

export default function Satellite() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Satellite" />
        <Text style={styles.title}>Field Monitor</Text>
        <Text style={styles.subtitle}>Sentinel-2 · Updated 2h ago</Text>

        <View style={styles.mapBox}>
          <View style={styles.mapGrid}>
            {Array.from({ length: 24 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.cell,
                  { backgroundColor: [palette.crops, palette.warning, palette.neon][i % 3], opacity: 0.25 + (i % 5) * 0.1 },
                ]}
              />
            ))}
          </View>
          <View style={styles.mapOverlay}>
            <Text style={styles.mapLabel}>OWEI FARM · KADUNA</Text>
          </View>
        </View>

        <View style={styles.statRow}>
          <StatCard value="0.72" label="NDVI" color={palette.neon} />
          <StatCard value="0.45" label="MOISTURE" color="#66d9ff" />
          <StatCard value="28°" label="TEMP" color={palette.warning} />
        </View>

        <GlassCard style={{ marginTop: spacing.lg }}>
          <Text style={styles.alertTitle}>⚠ 2 ALERT ZONES</Text>
          <View style={styles.divider} />
          <Text style={styles.alertItem}>• North corner — low NDVI</Text>
          <Text style={styles.alertItem}>• Center patch — moisture deficit</Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  mapBox: {
    aspectRatio: 1, marginTop: spacing.lg, borderRadius: radius.xl, overflow: 'hidden',
    backgroundColor: palette.abyss, borderWidth: 1, borderColor: palette.border,
    position: 'relative',
  },
  mapGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', height: '100%' },
  cell: { width: '25%', height: '16.66%' },
  mapOverlay: {
    position: 'absolute', bottom: spacing.md, left: spacing.md,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6,
  },
  mapLabel: { ...typography.micro, color: palette.neon },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  alertTitle: { ...typography.micro, color: palette.warning, marginBottom: spacing.md },
  divider: { height: 1, backgroundColor: palette.border, marginBottom: spacing.md },
  alertItem: { ...typography.body, color: palette.textMuted, marginBottom: spacing.sm },
});
