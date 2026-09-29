import React, { useEffect, useState } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { speak, stopSpeaking } from '../utils/tts';
import { palette, typography, spacing, radius } from '../theme';

interface Props {
  text: string;
  language?: string;
  label?: string;
}

export function SpeakButton({ text, language = 'english', label }: Props) {
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      stopSpeaking();
    };
  }, []);

  const onPress = async () => {
    if (speaking) {
      await stopSpeaking();
      setSpeaking(false);
    } else {
      setSpeaking(true);
      await speak(text, language);
      setSpeaking(false);
    }
  };

  return (
    <Pressable onPress={onPress} style={[styles.btn, speaking && styles.btnActive]}>
      <Text style={styles.icon}>{speaking ? '⏹' : '🔊'}</Text>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.surface,
    alignSelf: 'flex-start',
  },
  btnActive: {
    borderColor: palette.neon,
    backgroundColor: palette.neonSoft,
  },
  icon: { fontSize: 16 },
  label: {
    ...typography.micro,
    color: palette.neon,
    fontWeight: '700',
  },
});
