import { useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown, FadeIn, useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../src/theme';
import { typography, spacing, radius, shadows } from '../../src/theme';

const FEATURES = [
  { key: 'crops',     emoji: 'L', title: 'Crop Disease',   sub: '6 crops · 60+ diseases' },
  { key: 'pests',     emoji: 'B', title: 'Pest Detection', sub: '102 pest classes' },
  { key: 'soil',      emoji: 'S', title: 'Soil Analysis',  sub: '11 soil types' },
  { key: 'livestock', emoji: 'A', title: 'Livestock',      sub: 'Cattle + Poultry' },
];

export default function Home() {
  const router = useRouter();
  const { palette, mode, toggle } = useTheme();
  const { scansRemaining, plan, refreshScans } = require('../../src/store/auth').useAuth();

  const pulse = useSharedValue(1);
  useEffect(() => {
    refreshScans();
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1500 }),
        withTiming(1, { duration: 1500 })
      ),
      -1, true,
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = 'farmer';

  return (
    <View style={{ flex: 1, backgroundColor: palette.obsidian }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingTop: 60, paddingBottom: 100 }}>
        {/* Header with theme toggle */}
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ ...typography.body, color: palette.textMuted }}>{greeting},</Text>
              <Text style={{ fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 }}>
                {firstName}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable
                onPress={toggle}
                style={{
                  width: 44, height: 44, borderRadius: 22,
                  backgroundColor: palette.surface,
                  borderWidth: 1, borderColor: palette.border,
                  alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 20 }}>{mode === 'dark' ? 'S' : 'M'}</Text>
              </Pressable>
              <Animated.View style={pulseStyle}>
                <LinearGradient
                  colors={[palette.neon, palette.neonDim] as any}
                  style={{ width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ fontSize: 26, fontWeight: '900', color: mode === 'dark' ? '#000' : '#fff' }}>
                    {scansRemaining}
                  </Text>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: mode === 'dark' ? '#000' : '#fff', letterSpacing: 1.5 }}>
                    SCANS
                  </Text>
                </LinearGradient>
              </Animated.View>
            </View>
          </View>
        </Animated.View>

        {/* Plan card */}
        <Animated.View entering={FadeInDown.delay(100).duration(600)}>
          <View style={{
            marginTop: spacing.xl, padding: spacing.xl,
            borderRadius: radius.lg,
            backgroundColor: palette.surface,
            borderWidth: 1, borderColor: palette.border,
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ ...typography.micro, color: palette.textMuted }}>CURRENT PLAN</Text>
                <Text style={{ fontSize: 24, fontWeight: '900', color: palette.neon, marginTop: 4 }}>
                  {plan.toUpperCase()}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push('/buy-scans' as any)}
              style={{
                marginTop: spacing.lg, padding: 16, borderRadius: radius.md,
                borderWidth: 1.5, borderColor: palette.borderHi, alignItems: 'center',
              }}
            >
              <Text style={{ color: palette.neon, fontWeight: '800' }}>UPGRADE SCANS</Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* Diagnose section */}
        <Animated.View entering={FadeInDown.delay(300).duration(600)}>
          <Text style={{ ...typography.micro, color: palette.textMuted, marginTop: spacing.xxl, marginBottom: spacing.md }}>
            DIAGNOSE
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
            {FEATURES.map((f) => (
              <Pressable
                key={f.key}
                onPress={() => router.push(('/(tabs)/' + f.key) as any)}
                style={{
                  width: '48%',
                  padding: spacing.lg,
                  borderRadius: radius.lg,
                  backgroundColor: palette.surface,
                  borderWidth: 1, borderColor: palette.border,
                  minHeight: 140,
                }}
              >
                <Text style={{ fontSize: 32 }}>{f.emoji}</Text>
                <Text style={{ fontSize: 15, fontWeight: '800', color: palette.text, marginTop: spacing.md }}>
                  {f.title}
                </Text>
                <Text style={{ ...typography.micro, color: palette.textMuted, marginTop: 2 }}>
                  {f.sub}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}
