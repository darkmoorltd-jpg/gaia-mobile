import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { palette } from '../theme';

interface Props {
  visible: boolean;
  amount: number;
  scansAdded?: number;
  planName?: string;
  onDone?: () => void;
}

export default function PaymentCelebration({ visible, amount, scansAdded, planName, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const check = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { scale.setValue(0.4); opacity.setValue(0); check.setValue(0); return; }
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, tension: 90, useNativeDriver: true }),
    ]).start();
    Animated.timing(check, { toValue: 1, duration: 500, delay: 120, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(() => onDone?.());
    }, 2400);
    return () => clearTimeout(t);
  }, [visible]);

  if (!visible) return null;

  const checkScale = check.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] });

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Animated.Text style={[styles.check, { transform: [{ scale: checkScale }] }]}>✓</Animated.Text>
        <Text style={styles.amount}>N{amount.toLocaleString()}</Text>
        <Text style={styles.label}>Payment received</Text>
        {scansAdded ? <Text style={styles.sub}>+{scansAdded} scans added</Text> : null}
        {planName ? <Text style={styles.plan}>{planName.toUpperCase()}</Text> : null}
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#0d1117',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: palette.neon,
    paddingHorizontal: 40,
    paddingVertical: 34,
    alignItems: 'center',
    minWidth: 260,
    shadowColor: palette.neon,
    shadowOpacity: 0.7,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 0 },
    elevation: 20,
  },
  check: {
    fontSize: 56,
    color: palette.neon,
    fontWeight: '900',
    marginBottom: 8,
    textShadowColor: palette.neon,
    textShadowRadius: 16,
    textShadowOffset: { width: 0, height: 0 },
  },
  amount: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  label: { fontSize: 12, color: '#94a3b8', marginTop: 2, letterSpacing: 0.5 },
  sub: { fontSize: 13, color: palette.neon, marginTop: 12, fontWeight: '700' },
  plan: { fontSize: 10, color: '#6b7280', marginTop: 6, letterSpacing: 2, fontWeight: '800' },
});
