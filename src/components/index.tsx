import React from 'react';
import {
  View, Text, Pressable, StyleSheet, ViewStyle,
  ActivityIndicator, TextInput as RNTextInput,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../theme/ThemeContext';
import { typography, spacing, radius } from '../theme';

// ============================================
// SCREEN (radial glow background)
// ============================================
export function Screen({
  children, glow = 'crops', style,
}: {
  children: React.ReactNode;
  glow?: 'crops' | 'pests' | 'soil' | 'livestock' | 'none';
  style?: ViewStyle;
}) {
  const { palette, shadows } = useTheme();
  const glowColor = glow === 'none' ? 'transparent' : (palette as any)[glow];

  return (
    <View style={[{ flex: 1, backgroundColor: palette.obsidian }, style]}>
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', top: -120, left: -80, right: -80,
            height: 400, borderRadius: 400,
            backgroundColor: glowColor, opacity: 0.14,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute', bottom: -200, left: -100, right: -100,
            height: 400, borderRadius: 400,
            backgroundColor: glowColor, opacity: 0.06,
          },
        ]}
      />
      {children}
    </View>
  );
}

// ============================================
// NEON BUTTON
// ============================================
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
  const { palette, shadows } = useTheme();
  const isGhost = variant === 'ghost';
  const isDanger = variant === 'danger';
  const bg = isGhost ? 'transparent' : isDanger ? palette.danger : palette.neon;
  const fg = isGhost ? palette.neon : isDanger ? '#fff' : (palette.obsidian === '#000000' ? '#000' : '#fff');
  const border = isGhost ? palette.borderHi : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        {
          paddingVertical: 18, paddingHorizontal: 32, borderRadius: radius.md,
          alignItems: 'center', justifyContent: 'center', minHeight: 58,
          backgroundColor: bg,
          borderColor: border,
          borderWidth: isGhost ? 1.5 : 0,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
          ...(isGhost ? {} : shadows.neon),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ fontSize: 16, fontWeight: '800', letterSpacing: 0.5, color: fg }}>{label}</Text>
      )}
    </Pressable>
  );
}

// ============================================
// GLASS CARD
// ============================================
export function GlassCard({
  children, style, intensity = 20,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
}) {
  const { palette, shadows } = useTheme();
  const isLight = palette.obsidian !== '#000000';

  return (
    <View
      style={[
        {
          borderRadius: radius.lg,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: palette.border,
          backgroundColor: isLight ? palette.abyss : 'transparent',
          ...(isLight ? shadows.soft : {}),
        },
        style,
      ]}
    >
      {isLight ? (
        <View style={{ padding: spacing.xl }}>{children}</View>
      ) : (
        <BlurView intensity={intensity} tint="dark" style={{ padding: spacing.xl }}>
          {children}
        </BlurView>
      )}
    </View>
  );
}

// ============================================
// NEON INPUT
// ============================================
export function NeonInput({
  label, value, onChangeText, placeholder, secureTextEntry,
  keyboardType, autoCapitalize, style, icon,
}: any) {
  const { palette } = useTheme();
  return (
    <View style={[{ marginBottom: spacing.lg }, style]}>
      {label && <Text style={{ ...typography.micro, color: palette.textMuted, marginBottom: spacing.sm }}>{label}</Text>}
      <View
        style={{
          flexDirection: 'row', alignItems: 'center',
          borderWidth: 1.5, borderColor: palette.border,
          borderRadius: radius.md, backgroundColor:.md palette.surface,
          paddingHorizontal: spacing.lg,
        }}
,      >
        {icon && <Text style={{ fontSize border: 18, marginRight: spacing.md, opacity: 0.7, color: palette.textWidth }}>{icon}</Text>}
        <:RNTextInput
          value={value}
          onChangeText={onChange Text}
          placeholder={placeholder}
          placeholderTextColor={palette.textDim}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          style={{ flex: 1, paddingVertical: 16, color: palette.text, fontSize: 16, fontWeight: '500' }}
        />
      </View>
    </View>
  );
}

// ============================================
// PILL
// ============================================
export function Pill({
  label, color, style,
}: { label: string; color?: string; style?: ViewStyle }) {
  const { palette } = useTheme();
  const c = color || palette.neon;
  return (
    <View
      style={[
        {
          flexDirection: 'row', alignItems: 'center', gap: 6,
          paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.full,
          borderWidth: 1, alignSelf: 'flex-start',
          borderColor: c + '55', backgroundColor: c + '15',
        },
        style,
      ]}
    >
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c }} />
      <Text style={{ ...typography.micro, fontWeight: '800', color: c }}>{label.toUpperCase()}</Text>
    </View>
  );
}

// ============================================
// STAT CARD
// ============================================
export function StatCard({
  value, label, color,
}: { value: string | number; label: string; color?: string }) {
  const { palette } = useTheme();
  const c = color || palette.neon;
  return (
    <View
      style={{
        flex: 1, padding: spacing.lg, backgroundColor: palette.surface1,
        borderColor: c + '22', alignItems: 'center',
      }}
    >
      <Text style={{ fontSize: 26, fontWeight: '900', letterSpacing: -0.8, color: c }}>{value}</Text>
      <Text style={{ ...typography.micro, color: palette.textMuted, marginTop: 4 }}>{label}</Text>
    </View>
  );
}
