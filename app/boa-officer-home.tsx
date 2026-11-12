import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

export default function BoaOfficerHome() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);

  const [stats, setStats] = useState<any>(null);
  const [route, setRoute] = useState<any[]>([]);
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const [perf, r] = await Promise.all([
      supabase.rpc('boa_my_performance'),
      supabase.rpc('boa_route_today')
    ]);
    if (!perf.error) setStats(perf.data);
    if (!r.error) setRoute(r.data || []);
    setBusy(false); setRef(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        
        <Text style={styles.kicker}>FIELD OFFICER</Text>
        <Text style={styles.title}>My Route Today</Text>

        {busy && !stats ? <ActivityIndicator color={palette.neon} style={{ marginTop: 40 }} /> : null}

        {stats ? (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>{stats.visits_this_month}</Text>
              <Text style={styles.statLbl}>VISITS</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statVal, { color: palette.neon }]}>{stats.verified_pct}%</Text>
              <Text style={styles.statLbl}>VERIFIED</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statVal}>₦{Number(stats.cash_collected).toLocaleString()}</Text>
              <Text style={styles.statLbl}>COLLECTED</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>TODAY'S FARMERS ({route.length})</Text>
        {route.length === 0 && !busy ? (
          <Text style={styles.empty}>No visits scheduled for today.</Text>
        ) : route.map((r, i) => (
          <Pressable key={i} onPress={() => router.push(`/boa-visit?farmer=${r.borrower_id}` as any)} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardName} numberOfLines={1}>{r.name}</Text>
              <Text style={styles.cardDue}>{r.due_date ? new Date(r.due_date).toLocaleDateString() : 'Due'}</Text>
            </View>
            <Text style={styles.cardMeta}>{r.email}</Text>
            <View style={styles.cardRow}>
              <Text style={styles.cardOut}>₦{Number(r.outstanding).toLocaleString()}</Text>
              <Text style={styles.cardStatus}>{r.status.toUpperCase()}</Text>
            </View>
          </Pressable>
        ))}

        <Pressable onPress={() => router.push('/boa-visit' as any)} style={styles.cta}>
          <Text style={styles.ctaTxt}>📸 LOG A FIELD VISIT</Text>
        </Pressable>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  kicker: { fontSize: 11, fontWeight: '900', letterSpacing: 2, color: '#00ff88' },
  title: { fontSize: 32, fontWeight: '900', color: p.text, letterSpacing: -1, marginTop: 4, marginBottom: 20 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  statVal: { fontSize: 20, fontWeight: '900', color: p.text },
  statLbl: { fontSize: 9, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.8, color: p.textMuted, marginBottom: 12 },
  empty: { fontSize: 13, color: p.textMuted, textAlign: 'center', padding: 20 },
  card: { padding: 16, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, marginBottom: 10 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: '800', color: p.text, flex: 1 },
  cardDue: { fontSize: 11, fontWeight: '800', color: '#ff3b5c' },
  cardMeta: { fontSize: 11, color: p.textMuted },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  cardOut: { fontSize: 16, fontWeight: '900', color: p.text },
  cardStatus: { fontSize: 10, fontWeight: '900', color: '#ffb300' },
  cta: { marginTop: 20, padding: 18, borderRadius: 14, backgroundColor: '#00ff88', alignItems: 'center' },
  ctaTxt: { fontSize: 13, fontWeight: '900', color: '#000', letterSpacing: 1 },
});
