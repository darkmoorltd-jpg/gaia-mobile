import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle,
  ActivityIndicator, TextInput as RNTextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { palette, typography, spacing, radius, shadows } from '../theme';

export function NeonButton({
  label, onPress, loading, disabled, variant = 'primary', style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const bg = isGhost ? 'transparent' : isDanger ? palette.danger : palette.neon;
  const fg = isGhost ? palette.neon : isDanger ? '#fff' : '#000';
  const border = isGhost ? palette.borderHi : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.neonBtn,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isGhost ? 1.5 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.neonBtnText, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function GlassCard({
  children, style, intensity = 20,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}) {
  return (
    <View style={[styles.glassWrap, style]}>
      <BlurView intensity={intensity} tint="dark" style={styles.glassInner}>
        {children}
      </BlurView>
    </View>
  );
}

export function Screen({
  children, glow = 'crops', style,
}: {
  children: React.ReactNode;
  glow?: 'crops' | 'pests' | 'soil' | 'livestock' | 'none';
  style?: ViewStyle;
}) {
  const glowColor = glow === 'none' ? 'transparent' : palette[glow];

  return (
    <View style={[styles.screen, style]}>
      <View
        pointerEvents="none"
        style={[
          styles.topGlow,
          { backgroundColor: glowColor, opacity: 0.14 },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.bottomGlow,
          { backgroundColor: glowColor, opacity: 0.06 },
        ]}
      />
      {children}
    </View>
  );
}

export function NeonInput({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize, style, icon,
}: any) {
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {label && <Text style={styles.inputLabel}>{label}</Text>}
      <View style={styles.inputWrap}>
        {icon && <Text style={styles.inputIcon}>{icon}</Text>}
        <RNTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textDim}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={styles.input}
        />
      </View>
    </View>
  );
}

export function Pill({
  label, color = palette.neon, style,
}: {
  label: string;
  color?: string;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.pill, { borderColor: color + '55', backgroundColor: color + '15' }, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.pillText, { color }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

export function StatCard({
  value, label, color = palette.neon,
}: {
  value: string | number;
  label: string;
  color?: string;
}) {
  return (
    <View style={[styles.statCard, { borderColor: color + '22' }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.obsidian,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    left: -80,
    right: -80,
    height: 400,
    borderRadius: 400,
  },
  bottomGlow: {
    position: 'absolute',
    bottom: -200,
    left: -100,
    right: -100,
    height: 400,
    borderRadius: 400,
  },
  glassWrap: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.border,
  },
  glassInner: {
    padding: spacing.xl,
  },
  neonBtn: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 58,
  },
  neonBtnText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  inputLabel: {
    ...typography.micro,
    color: palette.textMuted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
  },
  inputIcon: {
    fontSize: 18,
    marginRight: spacing.md,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    color: palette.text,
    fontSize: 16,
    fontWeight: '500',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    ...typography.micro,
    fontWeight: '800',
  },
  statCard: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  statLabel: {
    ...typography.micro,
    color: palette.textMuted,
    marginTop: 4,
  },
});
