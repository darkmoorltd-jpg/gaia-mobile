import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function VideoHistory() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const { user } = useAuth();

  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    try {
      const { data } = await supabase
        .from('scan_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setRows(data || []);
    } catch {}
    setBusy(false); setRef(false);
  }, [user]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!user) {
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
          <Text style={styles.title}>Video Scan History</Text>
          <Text style={styles.sub}>Log in to see your scan sessions.</Text>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}
      >
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.kicker}>SESSIONS</Text>
        <Text style={styles.title}>Video History</Text>
        <Text style={styles.sub}>{rows.length} scan session{rows.length === 1 ? '' : 's'}</Text>

        {busy && rows.length === 0 ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {!busy && rows.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No sessions yet</Text>
            <Text style={styles.emptySub}>Run a video scan to see it here.</Text>
            <Pressable onPress={() => router.push('/video-scan' as any)} style={styles.cta}>
              <Text style={styles.ctaText}>START SCANNING</Text>
            </Pressable>
          </View>
        ) : null}

        {rows.map((r, i) => {
          const isHealthy = (r.consensus_label || '').toLowerCase().includes('healthy');
          const color = isHealthy ? palette.neon : (r.severity_pct > 40 ? palette.danger : palette.warning);
          return (
            <View key={i} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardCrop}>{(r.crop || '').replace('_', ' ').toUpperCase()}</Text>
                <Text style={styles.cardDate}>{new Date(r.created_at).toLocaleString()}</Text>
              </View>
              <Text style={[styles.cardLabel, { color }]}>{r.consensus_label || '—'}</Text>
              <View style={styles.statRow}>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{Number(r.consensus_conf || 0).toFixed(0)}%</Text>
                  <Text style={styles.statKey}>CONFIDENCE</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{r.vote_count}/{r.vote_total}</Text>
                  <Text style={styles.statKey}>VOTES</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statVal, { color: r.severity_pct > 40 ? palette.danger : palette.warning }]}>
                    {r.severity_pct || 0}%
                  </Text>
                  <Text style={styles.statKey}>SEVERITY</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statVal}>{r.duration_sec || 0}s</Text>
                  <Text style={styles.statKey}>DURATION</Text>
                </View>
              </View>
              {r.frames_analyzed ? (
                <Text style={styles.cardMeta}>{r.frames_analyzed} frames analyzed</Text>
              ) : null}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: p.neon },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4 },
  sub: { fontSize: 13, color: p.textMuted, marginTop: 6, marginBottom: 16 },
  empty: { padding: 30, alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: p.text },
  emptySub: { fontSize: 13, color: p.textMuted, marginTop: 8, textAlign: 'center' },
  cta: { padding: 14, borderRadius: 12, backgroundColor: p.neon, marginTop: 20 },
  ctaText: { fontSize: 12, fontWeight: '900', color: p.obsidian, letterSpacing: 1 },
  card: { padding: 16, borderRadius: 16, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardCrop: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: p.neon },
  cardDate: { fontSize: 10, color: p.textMuted },
  cardLabel: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  statRow: { flexDirection: 'row', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 14, fontWeight: '900', color: p.neon },
  statKey: { fontSize: 8, fontWeight: '800', letterSpacing: 1, color: p.textMuted, marginTop: 3 },
  cardMeta: { fontSize: 10, color: p.textDim, marginTop: 10, fontStyle: 'italic' },
});
