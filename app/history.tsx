
import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Screen, GlassCard, Pill } from '../src/components';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';
import { typography, spacing, radius } from '../src/theme';
import { useTheme } from '../src/theme';

const FILTERS = ['ALL', 'CROPS', 'PESTS', 'SOIL', 'LIVESTOCK'];

export default function History() {
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();
  const [scans, setScans] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');

  useFocusEffect(useCallback(() => {
    if (!user) return;
    supabase.from('scan_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data }) => setScans(data ?? []));
  }, [user]));

  const filtered = filter === 'ALL'
    ? scans
    : scans.filter((s) => s.type?.toUpperCase() === filter);

  return (
    <Screen glow="crops">
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Scan History</Text>
        <Text style={styles.subtitle}>All your AI diagnoses</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ marginTop: spacing.lg, marginBottom: spacing.lg }}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {FILTERS.map((f) => (
              <Pressable
                key={f}
                onPress={() => setFilter(f)}
                style={[styles.chip, filter === f && styles.chipActive]}
              >
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                  {f}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {filtered.length === 0 ? (
          <GlassCard>
            <Text style={styles.empty}>No scans yet.{'\n'}Start by taking a photo.</Text>
          </GlassCard>
        ) : (
          filtered.map((s, i) => (
            <Pressable key={i} style={{ marginBottom: spacing.md }}>
              <GlassCard>
                <View style={styles.row}>
                  <Text style={styles.emoji}>{s.emoji ?? '🌿'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{s.top_label}</Text>
                    <Text style={styles.itemSub}>
                      {s.type} · {new Date(s.created_at).toLocaleDateString()}
                    </Text>
                  </View>
                  <Text style={styles.score}>{s.confidence?.toFixed(0)}%</Text>
                </View>
              </GlassCard>
            </Pressable>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>
    </Screen>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 60 },
  title: { fontSize: 34, fontWeight: '900', color: palette.text, letterSpacing: -1 },
  subtitle: { ...typography.body, color: palette.textMuted, marginTop: spacing.sm },
  chip: {
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
    borderRadius: radius.full, borderWidth: 1, borderColor: palette.border,
    backgroundColor: palette.surface,
  },
  chipActive: { backgroundColor: palette.neonSoft, borderColor: palette.borderHi },
  chipText: { ...typography.micro, color: palette.textMuted },
  chipTextActive: { color: palette.neon },
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', lineHeight: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 32 },
  itemTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  itemSub: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  score: { fontSize: 18, fontWeight: '900', color: palette.neon },
});
