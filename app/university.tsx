
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Screen, GlassCard, Pill, NeonButton } from '../src/components';
import { typography, spacing, radius } from '../src/theme';
import { useTheme } from '../src/theme';

const COURSES = [
  { emoji: '🌽', title: 'Maize Agronomist', progress: 70, modules: '8 of 12' },
  { emoji: '🌾', title: 'Rice Farming Basics', progress: 20, modules: '2 of 10' },
  { emoji: '🌱', title: 'Soil Science', progress: 0, modules: '15 modules' },
  { emoji: '🐛', title: 'Pest Management', progress: 0, modules: '12 modules' },
];

export default function University() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Pill label="GAIA University" />
        <Text style={styles.title}>Learn farming</Text>
        <Text style={styles.subtitle}>Free courses for African farmers.</Text>

        {COURSES.map((c, i) => (
          <View key={i} style={{ marginBottom: spacing.md }}>
            <GlassCard>
              <View style={styles.courseHeader}>
                <Text style={styles.courseEmoji}>{c.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.courseTitle}>{c.title}</Text>
                  <Text style={styles.courseModules}>{c.modules}</Text>
                </View>
              </View>
              <View style={styles.barBg}>
                <View style={[styles.barFill, { width: `${c.progress}%` }]} />
              </View>
              <Text style={styles.progressText}>{c.progress}% complete</Text>
              <NeonButton
                label={c.progress > 0 ? 'CONTINUE' : 'START'}
                variant={c.progress > 0 ? 'primary' : 'ghost'}
                onPress={() => {}}
                style={{ marginTop: spacing.md }}
              />
            </GlassCard>
          </View>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1, marginTop: spacing.sm },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm, marginBottom: spacing.xl },
  courseHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.md },
  courseEmoji: { fontSize: 36 },
  courseTitle: { ...typography.body, color: palette.text, fontWeight: '800' },
  courseModules: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  barBg: { height: 4, backgroundColor: 'rgba(0,255,136,0.15)', borderRadius: 2, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: palette.neon, borderRadius: 2 },
  progressText: { ...typography.micro, color: palette.textDim, marginTop: 6 },
});
