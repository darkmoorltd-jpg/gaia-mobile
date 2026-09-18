
import { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, withDelay,
  withRepeat, withSequence, Easing, interpolate,
} from 'react-native-reanimated';
import { typography, spacing } from '../src/theme';
import { useTheme } from '../src/theme';

const { width, height } = Dimensions.get('window');

export default function Splash() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();

  const scale = useSharedValue(0.6);
  const opacity = useSharedValue(0);
  const glow = useSharedValue(0.3);

  useEffect(() => {
    scale.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.exp) });
    opacity.value = withTiming(1, { duration: 700 });

    glow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1600 }),
        withTiming(0.4, { duration: 1600 })
      ),
      -1, true,
    );

    const t = setTimeout(() => router.replace('/(auth)/onboarding'), 2400);
    return () => clearTimeout(t);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
  }));

  return (
    <View style={styles.container}>
      {/* Radial neon glow */}
      <Animated.View style={[styles.glowOuter, glowStyle]} />
      <Animated.View style={[styles.glowInner, glowStyle]} />

      <Animated.View style={[styles.center, logoStyle]}>
        <Text style={styles.leaf}>🌱</Text>
        <Text style={styles.brand}>GAIA</Text>
        <View style={styles.divider} />
        <Text style={styles.tagline}>GLOBAL AGRICULTURAL INTELLIGENCE ASSISTANT</Text>
      </Animated.View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>POWERED BY DARKMOOR LTD</Text>
      </View>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.obsidian,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    width: width * 1.4,
    height: width * 1.4,
    borderRadius: width,
    backgroundColor: palette.neon,
    opacity: 0.05,
  },
  glowInner: {
    position: 'absolute',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width,
    backgroundColor: palette.neon,
    opacity: 0.12,
  },
  center: { alignItems: 'center' },
  leaf: { fontSize: 80, marginBottom: 16 },
  brand: {
    fontSize: 64,
    fontWeight: '900',
    color: palette.text,
    letterSpacing: 10,
    textShadowColor: palette.neon,
    textShadowRadius: 24,
    textShadowOffset: { width: 0, height: 0 },
  },
  divider: {
    width: 60,
    height: 2,
    backgroundColor: palette.neon,
    marginVertical: 20,
    borderRadius: 1,
    shadowColor: palette.neon,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  tagline: {
    ...typography.micro,
    color: palette.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    fontSize: 11,
  },
  footer: {
    position: 'absolute',
    bottom: 40,
  },
  footerText: {
    ...typography.micro,
    color: palette.textDim,
    fontSize: 10,
  },
});
