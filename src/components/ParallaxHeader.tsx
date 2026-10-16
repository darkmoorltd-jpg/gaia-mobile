import React, { useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image } from 'react-native';
import { useTheme } from '../theme';

interface Props {
  imageUri: string;
  title: string;
  subtitle?: string;
  scrollY: Animated.Value;
  height?: number;
}

export default function ParallaxHeader({ imageUri, title, subtitle, scrollY, height = 260 }: Props) {
  const { palette } = useTheme();

  const translateY = scrollY.interpolate({
    inputRange: [-height, 0, height],
    outputRange: [-height / 2, 0, height * 0.5],
    extrapolate: 'clamp',
  });
  const scale = scrollY.interpolate({
    inputRange: [-height, 0],
    outputRange: [2, 1],
    extrapolateRight: 'clamp',
  });
  const overlayOpacity = scrollY.interpolate({
    inputRange: [0, height / 2],
    outputRange: [0.55, 0.9],
    extrapolate: 'clamp',
  });
  const titleY = scrollY.interpolate({
    inputRange: [0, height],
    outputRange: [0, -height * 0.4],
    extrapolate: 'clamp',
  });
  const titleOpacity = scrollY.interpolate({
    inputRange: [0, height * 0.7],
    outputRange: [1, 0.2],
    extrapolate: 'clamp',
  });

  return (
    <View style={{ height, overflow: 'hidden' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY }, { scale }] }]}>
        <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </Animated.View>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: '#000', opacity: overlayOpacity },
        ]}
      />
      <Animated.View style={[styles.content, { transform: [{ translateY: titleY }], opacity: titleOpacity }]}>
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    left: 22, right: 22, bottom: 28,
  },
  title: {
    fontSize: 34, fontWeight: '900', color: '#fff',
    letterSpacing: -0.8, textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 12, textShadowOffset: { width: 0, height: 2 },
  },
  subtitle: {
    fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 6,
    fontWeight: '600', letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 },
  },
});
