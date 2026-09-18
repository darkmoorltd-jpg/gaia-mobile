import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';
import { useAuth } from '../src/store/auth';

const FILTERS = ['ALL', 'CROPS', 'PESTS', 'SOIL', 'LIVESTOCK'];

export default function History() {
  const { palette } = useTheme();
  const { user } = useAuth();
  const styles = createStyles(palette);
  const [scans, setScans] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [busy, setBusy] = useState(true);

  useFocusEffect(useCallback(() => {
    if (!user) return;
    setBusy(true);
    supabase.from('scan_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setScans(data || []);
        setBusy(false);
      });
  }, [user]));

  const filtered = filter === 'ALL'
    ? scans
    : scans.filter((s) => (s.type || '').toUpperCase() === filter);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Scan History</Text>
        <Text style={styles.subtitle}>All your AI diagnoses</Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 16, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {FILTERS.map((f) => (
              <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, filter === f && styles.chipActive]}>
                <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>{f}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {!busy && filtered.length === 0 ? (
          <Text style={styles.empty}>No scans yet. Start by taking a photo.</Text>
        ) : null}

        {filtered.map((s, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.emoji}>{s.emoji || 'L'}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{s.top_label || 'Unknown'}</Text>
                <Text style={styles.itemSub}>
                  {s.type} · {new Date(s.created_at).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.score}>{Math.round(s.confidence || 0)}%</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (palette: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.obsidian },
  scroll: { paddingHorizontal: spacing.xl, paddingTop: 56 },
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
  empty: { ...typography.body, color: palette.textMuted, textAlign: 'center', marginTop: 40 },
  card: {
    padding: 16, borderRadius: 14, backgroundColor: palette.surface,
    borderWidth: 1, borderColor: palette.border, marginBottom: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  emoji: { fontSize: 28, fontWeight: '900', color: palette.neon },
  itemTitle: { ...typography.body, color: palette.text, fontWeight: '700' },
  itemSub: { ...typography.micro, color: palette.textMuted, marginTop: 4 },
  score: { fontSize: 18, fontWeight: '900', color: palette.neon },
});
