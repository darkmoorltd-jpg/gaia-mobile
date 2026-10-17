import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme, spacing, radius } from '../theme';
import { startWalk, WalkSession } from '../utils/walkMode';
import { tap as hapticTap, bump as hapticBump } from '../utils/haptics';

export default function WalkModeBanner() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const router = useRouter();
  const [active, setActive] = useState(false);
  const [session, setSession] = useState<WalkSession | null>(null);
  const [stop, setStop] = useState<(() => void) | null>(null);

  useEffect(() => {
    return () => { if (stop) stop(); };
  }, [stop]);

  const toggle = async () => {
    hapticBump();
    if (active && stop) {
      stop();
      setStop(null);
      setActive(false);
      Alert.alert('Field walk ended', `Distance: ${Math.round((session?.distance_m || 0) / 10) / 100} km · ${session?.prompts_triggered || 0} scan prompts`);
      return;
    }
    const stopper = await startWalk(
      200,
      (s) => setSession({ ...s }),
      (s) => {
        hapticTap();
        Alert.alert(
          'Scan prompt',
          `You've walked ${Math.round(s.distance_m)} m. Scan this spot?`,
          [
            { text: 'Skip', style: 'cancel' },
            { text: 'Open camera', onPress: () => router.push('/(tabs)/crops' as any) },
          ],
        );
      },
    );
    setStop(() => stopper);
    setActive(true);
  };

  return (
    <Pressable onPress={toggle} style={[styles.bar, active && styles.barActive]}>
      <Text style={styles.emoji}>{active ? '🚶' : '👣'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, active && { color: palette.obsidian }]}>
          {active ? 'Field walk · tracking' : 'Start field walk'}
        </Text>
        <Text style={[styles.sub, active && { color: 'rgba(0,0,0,0.6)' }]}>
          {active
            ? `${Math.round((session?.distance_m || 0))} m walked · ${session?.prompts_triggered || 0} prompts`
            : 'Auto-prompt to scan every 200 m'}
        </Text>
      </View>
      <Text style={[styles.chev, active && { color: palette.obsidian }]}>{active ? 'STOP' : '›'}</Text>
    </Pressable>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: p.surface, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: p.border, marginBottom: spacing.md,
  },
  barActive: { backgroundColor: p.neon, borderColor: p.neon },
  emoji: { fontSize: 22 },
  title: { fontSize: 13, fontWeight: '800', color: p.text },
  sub: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  chev: { fontSize: 11, fontWeight: '900', color: p.textMuted, letterSpacing: 1 },
});
