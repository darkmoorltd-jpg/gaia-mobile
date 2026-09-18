
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Screen, GlassCard, NeonButton, NeonInput, Pill } from '../src/components';
import { typography, spacing, radius } from '../src/theme';
import { useTheme } from '../src/theme';

const STEPS = [
  { key: 'account',  label: 'Account created',  done: true },
  { key: 'phone',    label: 'Phone verified',   done: true },
  { key: 'bvn',      label: 'BVN',              done: false },
  { key: 'id',       label: 'ID document',      done: false },
  { key: 'selfie',   label: 'Selfie',           done: false },
  { key: 'fee',      label: 'Pay ₦1,000',       done: false },
];

export default function Verification() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const done = STEPS.filter(s => s.done).length;
  const pct = Math.round((done / STEPS.length) * 100);

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="KYC" />
        <Text style={styles.title}>Verify Identity</Text>
        <Text style={styles.subtitle}>Unlock wallet, badges, insurance, marketplace.</Text>

        <GlassCard style={{ marginTop: spacing.xl }}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>PROGRESS</Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${pct}%` }]} />
          </View>
          <View style={{ marginTop: spacing.lg, gap: spacing.md }}>
            {STEPS.map((s) => (
              <View key={s.key} style={styles.stepRow}>
                <Text style={[styles.stepDot, s.done && styles.stepDotDone]}>
                  {s.done ? '✓' : '○'}
                </Text>
                <Text style={[styles.stepLabel, s.done && styles.stepLabelDone]}>
                  {s.label}
                </Text>
              </View>
            ))}
          </View>
        </GlassCard>

        <Text style={styles.sectionLabel}>STEP 3 · BVN</Text>
        <NeonInput
          label="BVN (11 DIGITS)"
          placeholder="22134567890"
          keyboardType="number-pad"
          icon="🔒"
        />
        <Text style={styles.hint}>Your BVN is used only for identity verification. We never store it.</Text>

        <NeonButton label="CONTINUE →" onPress={() => {}} />
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.md },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, lineHeight: 22 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { ...typography.micro, color: palette.textMuted },
  progressPct: { ...typography.micro, color: palette.neon },
  barBg: { height: 6, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 3, marginTop: spacing.sm },
  barFill: { height: '100%', backgroundColor: palette.neon, borderRadius: 3 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepDot: { fontSize: 18, color: palette.textDim, width: 24 },
  stepDotDone: { color: palette.neon },
  stepLabel: { ...typography.body, color: palette.textMuted },
  stepLabelDone: { color: palette.text },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md },
  hint: { ...typography.micro, color: palette.textDim, lineHeight: 16, marginBottom: spacing.lg },
});
