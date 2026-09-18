
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useState } from 'react';
import { Screen, GlassCard, Pill } from '../src/components';
import { typography, spacing, radius, shadows } from '../src/theme';
import { useTheme } from '../src/theme';

export default function Voice() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [listening, setListening] = useState(false);

  return (
    <Screen glow="livestock">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="Voice AI" color={palette.livestock} />
        <Text style={styles.title}>Agronomist</Text>
        <Text style={styles.subtitle}>Ask anything. In your language.</Text>

        <View style={styles.micWrap}>
          <Pressable
            onPress={() => setListening(!listening)}
            style={[styles.micOuter, listening && styles.micOuterActive]}
          >
            <View style={[styles.micInner, listening && styles.micInnerActive]}>
              <Text style={styles.micIcon}>🎙</Text>
            </View>
          </Pressable>
        </View>

        <Text style={styles.status}>
          {listening ? 'LISTENING…' : 'TAP TO SPEAK'}
        </Text>

        {listening && (
          <View style={styles.wave}>
            {[8, 16, 24, 32, 24, 16, 8, 16, 24, 16, 8].map((h, i) => (
              <View key={i} style={[styles.bar, { height: h }]} />
            ))}
          </View>
        )}

        <GlassCard style={{ marginTop: spacing.xxl }}>
          <Text style={styles.aiLabel}>🌱 GAIA</Text>
          <Text style={styles.aiText}>
            Your maize is showing early signs of leaf blight. I recommend applying Mancozeb 2g/L this evening.
          </Text>
        </GlassCard>

        <Text style={styles.sectionLabel}>TRY ASKING</Text>
        <GlassCard>
          <Text style={styles.example}>"Why are my leaves yellow?"</Text>
          <Text style={styles.example}>"When should I plant?"</Text>
          <Text style={styles.example}>"How do I kill armyworm?"</Text>
        </GlassCard>

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60, alignItems: 'center' },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm, alignSelf: 'flex-start' },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, alignSelf: 'flex-start' },
  micWrap: { marginTop: spacing.xxxl, alignItems: 'center' },
  micOuter: {
    width: 200, height: 200, borderRadius: 100,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: palette.borderHi,
  },
  micOuterActive: { borderColor: palette.neon, ...shadows.neon },
  micInner: {
    width: 140, height: 140, borderRadius: 70,
    backgroundColor: palette.neonSoft, alignItems: 'center', justifyContent: 'center',
  },
  micInnerActive: { backgroundColor: palette.neon },
  micIcon: { fontSize: 60 },
  status: { ...typography.micro, color: palette.neon, marginTop: spacing.xl, letterSpacing: 2 },
  wave: { flexDirection: 'row', gap: 4, marginTop: spacing.lg, alignItems: 'center', height: 40 },
  bar: { width: 4, backgroundColor: palette.neon, borderRadius: 2 },
  aiLabel: { ...typography.micro, color: palette.neon, marginBottom: spacing.sm },
  aiText: { ...typography.body, color: palette.text, lineHeight: 22 },
  sectionLabel: { ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md, alignSelf: 'flex-start' },
  example: { ...typography.body, color: palette.textMuted, marginBottom: 8 },
});
