
import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, Dimensions, ScrollView,
  Pressable, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { palette, typography, spacing, radius } from '../../src/theme';
import { NeonButton } from '../../src/components';

const { width } = Dimensions.get('window');

const SLIDES = [
  {
    icon: '📷',
    title: 'Diagnose any crop',
    subtitle: 'in seconds',
    body: 'Snap a leaf. GAIA reads disease, pests, and nutrient deficiency with 98% accuracy — offline, on any phone.',
    gradient: palette.gradientCrops,
  },
  {
    icon: '🎙️',
    title: 'Talk to your',
    subtitle: 'AI agronomist',
    body: 'Ask in Hausa, Yoruba, Igbo, Pidgin, or English. Get instant advice on planting, treatment, and harvest.',
    gradient: palette.gradientLive,
  },
  {
    icon: '🏅',
    title: 'Earn rewards',
    subtitle: 'as you farm',
    body: 'Badges, loans, insurance, and a marketplace — all in one app built for African farmers.',
    gradient: palette.gradientPests,
  },
];

export default function Onboarding() {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(idx);
  };

  const next = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    } else {
      router.replace('/(auth)/login');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>GAIA</Text>
        <Pressable onPress={() => router.replace('/(auth)/login')}>
          <Text style={styles.skip}>SKIP</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <View style={styles.iconWrap}>
              <LinearGradient
                colors={s.gradient as any}
                style={styles.iconGradient}
              >
                <Text style={styles.icon}>{s.icon}</Text>
              </LinearGradient>
            </View>
            <Text style={styles.title}>{s.title}</Text>
            <Text style={styles.subtitle}>{s.subtitle}</Text>
            <Text style={styles.body}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page && styles.dotActive,
                i === page && { width: 28 },
              ]}
            />
          ))}
        </View>
        <NeonButton
          label={page === SLIDES.length - 1 ? 'GET STARTED' : 'CONTINUE'}
          onPress={next}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: 70,
    paddingBottom: spacing.lg,
  },
  brand: {
    fontSize: 16,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: 4,
  },
  skip: {
    ...typography.micro,
    color: palette.textMuted,
  },
  slide: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrap: {
    marginBottom: spacing.xxxl,
    borderRadius: radius.xl,
    overflow: 'hidden',
    shadowColor: palette.neon,
    shadowOpacity: 0.4,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 0 },
  },
  iconGradient: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.xl,
  },
  icon: { fontSize: 64 },
  title: {
    ...typography.hero,
    color: palette.text,
    textAlign: 'center',
    lineHeight: 46,
  },
  subtitle: {
    ...typography.hero,
    color: palette.neon,
    textAlign: 'center',
    lineHeight: 46,
    marginBottom: spacing.xl,
  },
  body: {
    ...typography.body,
    color: palette.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    lineHeight: 22,
  },
  footer: { paddingHorizontal: spacing.xl, paddingBottom: 60 },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: palette.textDim,
  },
  dotActive: {
    backgroundColor: palette.neon,
    shadowColor: palette.neon,
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});
