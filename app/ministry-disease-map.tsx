import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme';
import { useAuth } from '../src/store/auth';
import { supabase } from '../src/api/supabase';

const ADMIN_EMAIL = 'darkmoorltd@gmail.com';

export default function MinistryDiseaseMap() {
  const router = useRouter();
  const { palette } = useTheme();
  const styles = createStyles(palette);
  const user = useAuth((s: any) => s.user);
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  const [rows, setRows] = useState<any[]>([]);
  const [window, setWindow] = useState(30);
  const [cropFilter, setCropFilter] = useState<string>('all');
  const [busy, setBusy] = useState(true);
  const [ref, setRef] = useState(false);

  const load = useCallback(async () => {
    if (!isAdmin) return;
    setBusy(true);
    const r = await supabase.rpc('ministry_disease_map', { p_days: window });
    if (!r.error) setRows(r.data || []);
    setBusy(false);
    setRef(false);
  }, [isAdmin, window]);

  useEffect(() => { load(); }, [load]);

  if (!isAdmin) return <View style={styles.blocked}><Text style={styles.blockedText}>Access denied</Text></View>;

  const crops = Array.from(new Set(rows.map(r => r.crop))).filter(Boolean).sort();
  const filtered = cropFilter === 'all' ? rows : rows.filter(r => r.crop === cropFilter);
  const totalCases = filtered.reduce((s, r) => s + Number(r.n || 0), 0);
  const uniqueStates = new Set(filtered.map(r => r.state)).size;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={ref} onRefresh={() => { setRef(true); load(); }} tintColor={palette.neon} />}>
        <Pressable onPress={() => router.back()}><Text style={styles.back}>BACK</Text></Pressable>
        <Text style={styles.title}>Disease Surveillance</Text>
        <Text style={styles.sub}>{totalCases} cases · {uniqueStates} states · last {window} days</Text>

        <View style={styles.chipRow}>
          {[7, 30, 90].map((d) => (
            <Pressable key={d} onPress={() => setWindow(d)} style={[styles.chip, window === d && styles.chipOn]}>
              <Text style={[styles.chipText, window === d && styles.chipTextOn]}>{d}D</Text>
            </Pressable>
          ))}
        </View>

        {crops.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
            <Pressable onPress={() => setCropFilter('all')} style={[styles.chip, cropFilter === 'all' && styles.chipOn]}>
              <Text style={[styles.chipText, cropFilter === 'all' && styles.chipTextOn]}>ALL CROPS</Text>
            </Pressable>
            {crops.map((c) => (
              <Pressable key={c} onPress={() => setCropFilter(c)} style={[styles.chip, cropFilter === c && styles.chipOn]}>
                <Text style={[styles.chipText, cropFilter === c && styles.chipTextOn]}>{String(c).toUpperCase()}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {busy ? <ActivityIndicator color={palette.neon} style={{ marginTop: 30 }} /> : null}

        {filtered.length === 0 && !busy ? (
          <View style={styles.empty}><Text style={styles.kv}>No disease reports in this window.</Text></View>
        ) : filtered.map((r, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardDisease} numberOfLines={1}>{r.disease}</Text>
              <Text style={styles.cardCount}>{r.n}</Text>
            </View>
            <Text style={styles.cardMeta}>{r.crop} · {r.state}{r.lga ? ' · ' + r.lga : ''}</Text>
            <View style={styles.cardRow}>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{r.unique_farmers}</Text>
                <Text style={styles.cardLbl}>FARMERS</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{r.avg_conf}%</Text>
                <Text style={styles.cardLbl}>AVG CONF</Text>
              </View>
              <View style={styles.cardStat}>
                <Text style={styles.cardVal}>{r.last_seen ? new Date(r.last_seen).toLocaleDateString() : '-'}</Text>
                <Text style={styles.cardLbl}>LAST SEEN</Text>
              </View>
            </View>
          </View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const createStyles = (p: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: p.obsidian },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 80 },
  back: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: p.textMuted, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '900', color: p.text, letterSpacing: -1 },
  sub: { fontSize: 12, color: p.textMuted, marginTop: 4, marginBottom: 16 },
  chipRow: { flexDirection: 'row', gap: 6, marginBottom: 10 },
  chipScroll: { gap: 6, paddingRight: 16, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: p.border, backgroundColor: p.surface },
  chipOn: { borderColor: p.neon, backgroundColor: 'rgba(0,255,136,0.12)' },
  chipText: { fontSize: 10, fontWeight: '800', color: p.textMuted, letterSpacing: 1 },
  chipTextOn: { color: p.neon },
  empty: { padding: 30, borderRadius: 14, backgroundColor: p.surface, borderWidth: 1, borderColor: p.border, alignItems: 'center' },
  kv: { fontSize: 12, color: p.textMuted },
  card: { padding: 14, borderRadius: 14, backgroundColor: p.surface, marginBottom: 8, borderWidth: 1, borderColor: p.border },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cardDisease: { fontSize: 14, fontWeight: '900', color: p.text, flex: 1, marginRight: 8 },
  cardCount: { fontSize: 18, fontWeight: '900', color: '#ff3b5c' },
  cardMeta: { fontSize: 11, color: p.textMuted, marginBottom: 10 },
  cardRow: { flexDirection: 'row', gap: 10 },
  cardStat: { flex: 1 },
  cardVal: { fontSize: 12, fontWeight: '900', color: p.text },
  cardLbl: { fontSize: 8, fontWeight: '800', color: p.textMuted, letterSpacing: 1, marginTop: 2 },
  blocked: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: p.obsidian },
  blockedText: { fontSize: 20, fontWeight: '900', color: p.danger },
});
