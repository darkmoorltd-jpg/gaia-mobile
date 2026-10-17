import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme, spacing, radius, typography } from '../src/theme';
import { supabase } from '../src/api/supabase';

const MEDALS = ['🥇', '🥈', '🥉'];

export default function AgentLeaderboard() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const { data } = await supabase.rpc('agent_leaderboard', { p_limit: 50 });
      setRows(data || []);
    } catch {}
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const myIndex = rows.findIndex((r) => r.is_me);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Agent Leaderboard</Text>
        <Text style={styles.sub}>Weekly rankings · resets every Sunday</Text>

        {myIndex >= 0 ? (
          <View style={styles.myCard}>
            <Text style={styles.myKicker}>YOU</Text>
            <Text style={styles.myRank}>#{myIndex + 1}</Text>
            <Text style={styles.myMeta}>{rows[myIndex].this_week} this week · {rows[myIndex].verified_total} total</Text>
          </View>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 20 }} /> : null}

        {rows.map((r, i) => (
          <View key={r.agent_id} style={[styles.row, r.is_me && styles.rowMe]}>
            <View style={styles.rankBox}>
              <Text style={styles.rankNum}>{MEDALS[i] || '#' + (i + 1)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.meta} numberOfLines={1}>
                {r.agent_code} · {r.agent_zone || 'no zone'}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.weekCount}>{r.this_week}</Text>
              <Text style={styles.weekLbl}>this week</Text>
            </View>
          </View>
        ))}

        {!busy && rows.length === 0 ? <Text style={styles.empty}>No agents ranked yet.</Text> : null}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 4, marginBottom: 20 },
  myCard: { backgroundColor: 'rgba(0,255,136,0.08)', borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: p.neon, marginBottom: 20, alignItems: 'center' },
  myKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 2, color: p.neon },
  myRank: { fontSize: 38, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  myMeta: { fontSize: 12, color: p.textMuted, marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 8 },
  rowMe: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.05)' },
  rankBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  rankNum: { fontSize: 18, fontWeight: '900', color: p.text },
  name: { fontSize: 14, fontWeight: '800', color: p.text },
  meta: { fontSize: 11, color: p.textMuted, marginTop: 2 },
  weekCount: { fontSize: 20, fontWeight: '900', color: p.neon },
  weekLbl: { fontSize: 9, color: p.textMuted, fontWeight: '700', letterSpacing: 1 },
  empty: { textAlign: 'center', color: p.textMuted, paddingVertical: 40 },
});
