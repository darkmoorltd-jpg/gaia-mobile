
import { View, Text, StyleSheet } from 'react-native';
import { Screen, GlassCard, NeonButton, Pill } from '../../src/components';
import { palette, typography, spacing, radius } from '../../src/theme';
import { useAuth } from '../../src/store/auth';

export default function SoilScreen() {
  const scans = useAuth((s) => s.scansRemaining);
  return (
    <Screen glow="soil">
      <View style={styles.container}>
        <Pill label="COMING SOON" color="{palette.soil}" />
        <Text style={styles.icon}>🏞</Text>
        <Text style={styles.title}>Soil</Text>
        <Text style={styles.subtitle}>Analyze 11 soil types from a photo</Text>
        <GlassCard style={{ marginTop: spacing.xxl, width: '100%' }}>
          <Text style={styles.cardLabel}>SCANS REMAINING</Text>
          <Text style={styles.cardValue}>{scans}</Text>
        </GlassCard>
        <NeonButton
          label="OPEN CAMERA"
          onPress={() => {}}
          style={{ marginTop: spacing.lg, width: '100%' }}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing.xl, paddingTop: 80,
  },
  icon: { fontSize: 96, marginVertical: spacing.xl },
  title: {
    fontSize: 38, fontWeight: '900', color: palette.text,
    letterSpacing: -1.5,
  },
  subtitle: {
    ...typography.body, color: palette.textMuted,
    textAlign: 'center', marginTop: spacing.sm, lineHeight: 22,
  },
  cardLabel: { ...typography.micro, color: palette.textMuted, textAlign: 'center' },
  cardValue: {
    fontSize: 48, fontWeight: '900', color: palette.neon,
    textAlign: 'center', marginTop: 4,
  },
});
