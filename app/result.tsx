import { View, Text, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, typography, spacing, radius, shadows } from '../src/theme';

export default function ResultScreen() {
  const router = useRouter();
  const { data } = useLocalSearchParams<{ data: string }>();
  const parsed = JSON.parse(data ?? '{}');

  const predictions = parsed.predictions ?? [];
  const top = parsed.top ?? { label: 'Unknown', confidence: 0 };
  const gradcamImage = parsed.gradcam_image;
  const isHealthy = String(top.label).toLowerCase().includes('healthy');
  const accent = isHealthy ? palette.neon : palette.warning;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={[styles.hero, { backgroundColor: accent + '22', borderColor: accent }]}>
          <Text style={[styles.heroEmoji, { color: accent }]}>
            {isHealthy ? '\u2713' : '\u26A0'}
          </Text>
          <Text style={styles.heroLabel}>{String(top.label)}</Text>
          <Text style={styles.heroConf}>
            {Number(top.confidence).toFixed(1)}% CONFIDENCE
          </Text>
        </View>

        {gradcamImage ? (
          <View>
            <Text style={styles.sectionLabel}>WHAT THE AI FOCUSED ON</Text>

            <View style={styles.camWrap}>
              <Image source={{ uri: gradcamImage }} style={styles.camImage} resizeMode="cover" />
            </View>

            <LinearGradient
              colors={['#00007f', '#0000ff', '#00ffff', '#ffff00', '#ff0000', '#7f0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.legendBar}
            />

            <View style={styles.legendLabels}>
              <Text style={styles.legendText}>LOW FOCUS</Text>
              <Text style={styles.legendText}>HIGH FOCUS</Text>
            </View>

            <Text style={styles.camCaption}>
              Red areas are where the AI saw the strongest signal for{' '}
              <Text style={styles.camCaptionBold}>{String(top.label)}</Text>.
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>ALL PREDICTIONS</Text>

        {predictions.map((p: any, i: number) => (
          <View key={i} style={styles.predCard}>
            <View style={styles.predRow}>
              <Text style={styles.predLabel}>{String(p.label)}</Text>
              <Text style={styles.predPct}>{Number(p.confidence).toFixed(1)}%</Text>
            </View>
            <View style={styles.barBg}>
              <View style={[styles.barFill, { width: Math.min(Number(p.confidence), 100) + '%' }]} />
            </View>
          </View>
        ))}

        <View style={{ height: spacing.xl }} />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>NEW SCAN</Text>
        </TouchableOpacity>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 70, paddingBottom: 40 },

  hero: {
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: spacing.xl,
  },
  heroEmoji: { fontSize: 56, fontWeight: '900' },
  heroLabel: {
    fontSize: 24, fontWeight: '900', color: palette.text,
    marginTop: spacing.md, textAlign: 'center', letterSpacing: -0.5,
  },
  heroConf: { ...typography.micro, color: palette.textMuted, marginTop: spacing.sm },

  sectionLabel: {
    ...typography.micro, color: palette.textMuted,
    marginTop: spacing.xl, marginBottom: spacing.md,
  },

  camWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.borderHi,
    backgroundColor: palette.surface,
  },
  camImage: { width: '100%', aspectRatio: 1 },
  legendBar: { height: 8, borderRadius: 4, marginTop: spacing.md },
  legendLabels: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm,
  },
  legendText: { ...typography.micro, color: palette.textDim },
  camCaption: {
    ...typography.caption, color: palette.textMuted,
    marginTop: spacing.md, lineHeight: 20,
  },
  camCaptionBold: { color: palette.neon, fontWeight: '800' },

  predCard: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: palette.border,
  },
  predRow: {
    flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm,
  },
  predLabel: { ...typography.body, color: palette.text, fontWeight: '600', flex: 1 },
  predPct: { color: palette.neon, fontWeight: '800' },
  barBg: {
    height: 6, backgroundColor: 'rgba(0,255,136,0.12)',
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', backgroundColor: palette.neon, borderRadius: 3 },

  backBtn: {
    paddingVertical: 18,
    borderRadius: radius.md,
    backgroundColor: palette.neon,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#000', fontSize: 16, fontWeight: '900', letterSpacing: 1,
  },
});
