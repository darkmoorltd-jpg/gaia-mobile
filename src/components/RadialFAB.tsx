import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { tap as hapticTap } from '../utils/haptics';

const { width: W, height: H } = Dimensions.get('window');

interface Spoke {
  emoji: string;
  label: string;
  route: string;
  color: string;
}

const SPOKES: Spoke[] = [
  { emoji: '\uD83D\uDC1B', label: 'Pest',   route: '/(tabs)/pests',      color: '#ff9800' },
  { emoji: '\uD83C\uDF3F', label: 'Crops',  route: '/(tabs)/crops',      color: '#00c853' },
  { emoji: '\uD83C\uDFE0', label: 'Soil',   route: '/(tabs)/soil',       color: '#8d6e63' },
  { emoji: '\uD83D\uDC04', label: 'Animal', route: '/(tabs)/livestock',  color: '#7c4dff' },
  { emoji: '\uD83C\uDFA4', label: 'Voice',  route: '/(tabs)/voice',      color: '#00bcd4' },
];

export default function RadialFAB() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [open, setOpen] = useState(false);
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(spin, { toValue: open ? 1 : 0, duration: 340, easing: Easing.out(Easing.back(1.4)), useNativeDriver: true }),
      Animated.timing(fade, { toValue: open ? 1 : 0, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [open]);

  const rotation = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '135deg'] });

  const radius = 130;

  return (
    <>
      {open ? (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
      ) : null}

      <View pointerEvents="box-none" style={styles.host}>
        {SPOKES.map((spoke, i) => {
          const angle = (Math.PI / 2) + (i / (SPOKES.length - 1)) * Math.PI; // 180° fan above the button
          const dx = Math.cos(angle) * radius;
          const dy = Math.sin(angle) * radius;

          const tx = spin.interpolate({ inputRange: [0, 1], outputRange: [0, dx] });
          const ty = spin.interpolate({ inputRange: [0, 1], outputRange: [0, -dy] });
          const scale = spin.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });

          return (
            <Animated.View
              key={spoke.route}
              style={[
                styles.spoke,
                { opacity: fade, transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
              ]}
            >
              <Pressable
                onPress={() => {
                  hapticTap();
                  setOpen(false);
                  setTimeout(() => {
                    try { router.push(spoke.route as any); } catch {}
                  }, 180);
                }}
                style={[styles.spokeBtn, { backgroundColor: spoke.color + '22', borderColor: spoke.color }]}
              >
                <Text style={styles.spokeEmoji}>{spoke.emoji}</Text>
              </Pressable>
              <Text style={[styles.spokeLabel, { color: spoke.color }]}>{spoke.label}</Text>
            </Animated.View>
          );
        })}

        <Pressable
          onPress={() => { hapticTap(); setOpen((o) => !o); }}
          style={[styles.mainBtn, open && styles.mainBtnOpen]}
        >
          <Animated.Text style={[styles.mainIcon, { transform: [{ rotate: rotation }] }]}>
            +
          </Animated.Text>
        </Pressable>
      </View>
    </>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  host: {
    position: 'absolute',
    right: 22,
    bottom: 110,
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  mainBtn: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: p.neon,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: p.neon, shadowOpacity: 0.7, shadowRadius: 18, shadowOffset: { width: 0, height: 4 },
    elevation: 12,
  },
  mainBtnOpen: { backgroundColor: '#ff3b5c', shadowColor: '#ff3b5c' },
  mainIcon: { fontSize: 36, fontWeight: '300', color: '#000', lineHeight: 38, marginTop: -3 },
  spoke: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spokeBtn: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
    shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  spokeEmoji: { fontSize: 24 },
  spokeLabel: {
    fontSize: 9, fontWeight: '800', letterSpacing: 0.8,
    marginTop: 4, textAlign: 'center',
  },
});
