import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing, ViewStyle } from 'react-native';
import { useTheme } from '../theme';

interface BlockProps {
  width?: number | string;
  height?: number;
  radius?: number;
  style?: ViewStyle | ViewStyle[];
}

export function SkeletonBlock({ width = '100%', height = 14, radius = 8, style }: BlockProps) {
  const { palette } = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.timing(shimmer, {
      toValue: 1, duration: 1200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = shimmer.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.25, 0.55, 0.25],
  });

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: palette.surface, opacity },
        style,
      ]}
    />
  );
}

export function SkeletonRow() {
  return (
    <View style={rowStyles.row}>
      <SkeletonBlock width={52} height={52} radius={26} />
      <View style={rowStyles.col}>
        <SkeletonBlock width="70%" height={14} />
        <View style={{ height: 8 }} />
        <SkeletonBlock width="90%" height={12} />
      </View>
    </View>
  );
}

export function SkeletonCard() {
  return (
    <View style={rowStyles.card}>
      <SkeletonBlock width="100%" height={140} radius={14} />
      <View style={{ height: 12 }} />
      <SkeletonBlock width="60%" height={14} />
      <View style={{ height: 8 }} />
      <SkeletonBlock width="40%" height={12} />
    </View>
  );
}

export function SkeletonList({ count = 6, variant = 'row' as 'row' | 'card' }) {
  const items = Array.from({ length: count });
  return (
    <View style={{ paddingHorizontal: 16 }}>
      {items.map((_, i) => variant === 'row' ? <SkeletonRow key={i} /> : <SkeletonCard key={i} />)}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  col: { flex: 1 },
  card: { padding: 12, borderRadius: 16, marginBottom: 14 },
});
