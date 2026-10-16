import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme';
import { useAuth } from '../store/auth';
import { bumpStreak, StreakInfo, streakEmoji } from '../utils/streak';

export default function StreakWidget() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const wiggle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    (async () => {
      const s = await bumpStreak();
      if (mounted) setStreak(s);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wiggle, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: -1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(wiggle, { toValue: 0, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.delay(4500),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  if (!streak || streak.current_streak < 1) return null;

  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-12deg', '12deg'] });

  return (
    <View style={styles.chip}>
      <Animated.Text style={[styles.icon, { transform: [{ rotate }] }]}>
        {streakEmoji(streak.current_streak)}
      </Animated.Text>
      <View>
        <Text style={styles.num}>{streak.current_streak} day{streak.current_streak === 1 ? '' : 's'}</Text>
        <Text style={styles.sub}>in a row - best {streak.longest_streak}</Text>
      </View>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: 'rgba(255,152,0,0.12)', borderWidth: 1, borderColor: 'rgba(255,152,0,0.35)', alignSelf: 'flex-start', marginBottom: 12 },
  icon: { fontSize: 22 },
  num: { fontSize: 14, fontWeight: '900', color: '#ff9800', letterSpacing: 0.2 },
  sub: { fontSize: 10, color: p.textMuted, marginTop: 1, letterSpacing: 0.4 },
});
