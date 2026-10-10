import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme';
import { supabase } from '../src/api/supabase';

const KINDS = [
  { k: 'sprayed',    label: 'Sprayed',     emoji: '🧪' },
  { k: 'weeded',     label: 'Weeded',      emoji: '🌿' },
  { k: 'fertilized', label: 'Fertilized',  emoji: '💩' },
  { k: 'watered',    label: 'Watered',     emoji: '💧' },
  { k: 'rained',     label: 'Rain',        emoji: '🌧' },
  { k: 'disease',    label: 'Disease seen',emoji: '🦠' },
  { k: 'pest',       label: 'Pest seen',   emoji: '🐛' },
  { k: 'note',       label: 'Note',        emoji: '📝' },
];

export default function SeasonLog() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const { palette } = useTheme();
  const styles = createStyles(palette);

  const [kind, setKind] = useState('sprayed');
  const [label, setLabel] = useState('');
  const [cost, setCost] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!params.id) return;
    setBusy(true);
    const { error } = await supabase.rpc('season_log_event', {
      p_season_id: params.id,
      p_kind: kind,
      p_label: label || KINDS.find((k) => k.k === kind)?.label || kind,
      p_stage: null,
      p_cost_naira: parseFloat(cost) || 0,
      p_detail: {},
      p_image_url: null,
    });
    setBusy(false);
    if (error) { Alert.alert('Failed', error.message); return; }
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Log activity</Text>
        <Text style={styles.sub}>Every entry builds your season report.</Text>

        <View style={styles.kindGrid}>
          {KINDS.map((k) => (
            <Pressable key={k.k} onPress={() => setKind(k.k)} style={[styles.kind, kind === k.k && styles.kindOn]}>
              <Text style={styles.kindEmoji}>{k.emoji}</Text>
              <Text style={[styles.kindTxt, kind === k.k && styles.kindTxtOn]}>{k.label}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>NOTE (OPTIONAL)</Text>
        <TextInput value={label} onChangeText={setLabel}
          placeholder="e.g. sprayed Emamectin for FAW" placeholderTextColor={palette.textDim}
          style={[styles.input, { minHeight: 60 }]} multiline />

        <Text style={styles.label}>COST (NAIRA)</Text>
        <TextInput value={cost} onChangeText={setCost} keyboardType="numeric"
          placeholder="0" placeholderTextColor={palette.textDim} style={styles.input} />

        <Pressable onPress={submit} disabled={busy} style={[styles.cta, busy && { opacity: 0.5 }]}>
          {busy ? <ActivityIndicator color={palette.obsidian} /> : <Text style={styles.ctaTxt}>SAVE</Text>}
        </Pressable>
        <View style={{ height: 60 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 30, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 20, lineHeight: 19 },
  kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  kind: { width: '31%', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface, alignItems: 'center' },
  kindOn: { borderColor: '#00ff88', backgroundColor: 'rgba(0,255,136,0.1)' },
  kindEmoji: { fontSize: 20 },
  kindTxt: { fontSize: 10, fontWeight: '700', color: p.textMuted, marginTop: 6, textAlign: 'center' },
  kindTxtOn: { color: '#00ff88' },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginTop: 16, marginBottom: 8 },
  input: { paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, color: p.text, fontSize: 15 },
  cta: { marginTop: 24, padding: 18, borderRadius: 14, backgroundColor: p.neon, alignItems: 'center' },
  ctaTxt: { fontSize: 14, fontWeight: '900', color: p.obsidian, letterSpacing: 1.5 },
});
