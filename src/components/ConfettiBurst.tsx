import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, Dimensions } from 'react-native';

interface Props {
  fire: boolean;
  count?: number;
  colors?: string[];
  duration?: number;
  origin?: 'center' | 'top';
}

const W = Dimensions.get('window').width;
const H = Dimensions.get('window').height;

export default function ConfettiBurst({
  fire,
  count = 28,
  colors = ['#00ff88', '#69f0ae', '#4caf50', '#ffd700', '#ff9800'],
  duration = 1400,
  origin = 'center',
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;

  // ⚠️ CRITICAL: all hooks must be called UNCONDITIONALLY (before any early return).
  // The previous version called useMemo after `if (!fire) return null;`,
  // which violated the Rules of Hooks and crashed React on the first fire.
  const particles = React.useMemo(() => {
    const arr = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = 80 + Math.random() * 140;
      arr.push({
        key: `p${i}`,
        dx: Math.cos(angle) * dist,
        dy: origin === 'top'
          ? Math.abs(Math.sin(angle)) * dist
          : Math.sin(angle) * dist,
        rotate: Math.random() * 720 - 360,
        size: 5 + Math.random() * 6,
        color: colors[i % colors.length],
      });
    }
    return arr;
  }, [count, origin]);

  useEffect(() => {
    if (!fire) {
      progress.setValue(0);
      return;
    }
    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [fire, duration]);

  // Early return AFTER all hooks
  if (!fire) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p) => (
        <Animated.View
          key={p.key}
          style={[
            styles.particle,
            {
              backgroundColor: p.color,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              top: origin === 'top' ? 40 : H / 2 - 6,
              left: W / 2 - 3,
              opacity: progress.interpolate({
                inputRange: [0, 0.7, 1],
                outputRange: [1, 0.9, 0],
              }),
              transform: [
                { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', p.rotate + 'deg'] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: { position: 'absolute' },
});
