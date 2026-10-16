import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { palette } from '../theme';

const MESSAGES = [
  'Waking up GAIA',
  'Loading crop models',
  'Preparing your fields',
  'Syncing with satellites',
  'Warming up the AI',
  'Almost ready',
];

export default function GaiaSplash() {
  const [msgIdx, setMsgIdx] = useState(0);

  const pulse = useRef(new Animated.Value(0)).current;
  const scan = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops: any[] = [];

    loops.push(Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])));

    loops.push(Animated.loop(Animated.timing(scan, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })));

    loops.push(Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 6000, easing: Easing.linear, useNativeDriver: true })));

    const dotLoop = (anim: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(anim, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    loops.push(dotLoop(dot1, 0));
    loops.push(dotLoop(dot2, 700));
    loops.push(dotLoop(dot3, 1400));

    loops.forEach((l) => l.start());
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();

    return () => loops.forEach((l) => l.stop());
  }, []);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % MESSAGES.length), 1400);
    return () => clearInterval(t);
  }, []);

  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const scanX = scan.interpolate({ inputRange: [0, 1], outputRange: [-140, 140] });
  const orbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const dotY = (a: Animated.Value) => a.interpolate({ inputRange: [0, 1], outputRange: [10, -40] });
  const dotOpacity = (a: Animated.Value) => a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.9, 0] });

  return (
    <Animated.View style={[styles.root, { opacity: fadeIn }]}>
      <Animated.View style={[styles.orbitRing, { transform: [{ rotate: orbitRotate }] }]}>
        <View style={styles.orbitDot} />
      </Animated.View>

      <View style={styles.dotsLayer}>
        <Animated.View style={[styles.particle, styles.p1, { opacity: dotOpacity(dot1), transform: [{ translateY: dotY(dot1) }] }]} />
        <Animated.View style={[styles.particle, styles.p2, { opacity: dotOpacity(dot2), transform: [{ translateY: dotY(dot2) }] }]} />
        <Animated.View style={[styles.particle, styles.p3, { opacity: dotOpacity(dot3), transform: [{ translateY: dotY(dot3) }] }]} />
      </View>

      <Animated.View style={{ transform: [{ scale: glowScale }] }}>
        <Animated.Text style={[styles.logo, { opacity: glowOpacity }]}>GAIA</Animated.Text>
      </Animated.View>

      <Text style={styles.tag}>GLOBAL AGRICULTURAL INTELLIGENCE ASSISTANT</Text>

      <View style={styles.scanTrack}>
        <Animated.View style={[styles.scanBeam, { transform: [{ translateX: scanX }] }]} />
      </View>

      <Text style={styles.status}>{MESSAGES[msgIdx]}</Text>

      <View style={styles.spacer} />

      <Text style={styles.brand}>POWERED BY DARKMOORAI</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  orbitRing: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.15)',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  orbitDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  dotsLayer: {
    position: 'absolute',
    width: 240,
    height: 240,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#00ff88',
  },
  p1: { left: 20, top: 120 },
  p2: { right: 30, top: 80 },
  p3: { left: 100, top: 20 },
  logo: {
    fontSize: 78,
    fontWeight: '900',
    letterSpacing: 14,
    color: '#00ff88',
    textShadowColor: '#00ff88',
    textShadowRadius: 26,
    textShadowOffset: { width: 0, height: 0 },
  },
  tag: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 3,
    color: '#6b7280',
    marginTop: 14,
    textAlign: 'center',
  },
  scanTrack: {
    width: 280,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 2,
    marginTop: 48,
    overflow: 'hidden',
  },
  scanBeam: {
    width: 60,
    height: 2,
    backgroundColor: '#00ff88',
    shadowColor: '#00ff88',
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  status: {
    fontSize: 11,
    color: '#00ff88',
    marginTop: 20,
    letterSpacing: 2,
    fontWeight: '600',
  },
  spacer: { flex: 1 },
  brand: {
    fontSize: 9,
    letterSpacing: 4,
    color: '#3a3a3a',
    fontWeight: '700',
  },
});
